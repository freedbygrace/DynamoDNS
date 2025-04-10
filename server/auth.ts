import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as LdapStrategy } from "passport-ldapauth";
import { Strategy as OpenIDConnectStrategy } from "passport-openidconnect";
import { Express, Request } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, InsertUser } from "@shared/schema";
import { z } from "zod";
import 'dotenv/config';

// Authentication configuration from environment variables
export const CONFIG = {
  // Local auth configuration
  LOCAL_AUTH_ENABLED: process.env.LOCAL_AUTH_ENABLED !== 'false', // Enabled by default
  DISABLE_REGISTRATION: process.env.DISABLE_REGISTRATION === 'true', // Disabled by default
  DEFAULT_ADMIN_USERNAME: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
  DEFAULT_ADMIN_PASSWORD: process.env.DEFAULT_ADMIN_PASSWORD || 'password',
  DEFAULT_ADMIN_EMAIL: process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com',
  
  // LDAP configuration
  LDAP_ENABLED: process.env.LDAP_ENABLED === 'true',
  LDAP_URL: process.env.LDAP_URL || 'ldap://localhost:389',
  LDAP_BIND_DN: process.env.LDAP_BIND_DN || '',
  LDAP_BIND_CREDENTIALS: process.env.LDAP_BIND_CREDENTIALS || '',
  LDAP_SEARCH_BASE: process.env.LDAP_SEARCH_BASE || '',
  LDAP_SEARCH_FILTER: process.env.LDAP_SEARCH_FILTER || '(uid={{username}})',
  LDAP_AUTO_REGISTER: process.env.LDAP_AUTO_REGISTER === 'true',
  
  // OIDC configuration
  OIDC_ENABLED: process.env.OIDC_ENABLED === 'true',
  OIDC_ISSUER: process.env.OIDC_ISSUER || '',
  OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID || '',
  OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET || '',
  OIDC_CALLBACK_URL: process.env.OIDC_CALLBACK_URL || 'http://localhost:5000/api/auth/oidc/callback',
  OIDC_SCOPE: process.env.OIDC_SCOPE || 'openid profile email',
  OIDC_AUTO_REGISTER: process.env.OIDC_AUTO_REGISTER === 'true',
  OIDC_BUTTON_TEXT: process.env.OIDC_BUTTON_TEXT || 'Sign in with OpenID Connect'
};

declare global {
  namespace Express {
    interface User extends User {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Function to ensure admin user exists with environment-configured credentials
async function ensureAdminUser() {
  try {
    // Check if admin user with configured username exists
    const adminUsername = CONFIG.DEFAULT_ADMIN_USERNAME;
    let adminUser = await storage.getUserByUsername(adminUsername);
    
    if (!adminUser) {
      console.log(`Creating default admin user: ${adminUsername}`);
      
      // Create default admin user from environment variables
      adminUser = await storage.createUser({
        username: adminUsername,
        password: await hashPassword(CONFIG.DEFAULT_ADMIN_PASSWORD),
        email: CONFIG.DEFAULT_ADMIN_EMAIL,
        role: 'admin',
        fullName: 'System Administrator'
      });
      
      console.log(`Default admin user created successfully: ${adminUsername}`);
    } else {
      console.log(`Default admin user already exists: ${adminUsername}`);
    }
  } catch (error) {
    console.error('Error ensuring admin user exists:', error);
  }
}

// API Token Authentication middleware
export function authenticateApiToken(req: Request, res: any, next: any) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  const token = authHeader.split(' ')[1];
  
  storage.getApiTokenByToken(token).then(apiToken => {
    if (apiToken && apiToken.isActive) {
      req.apiToken = apiToken;
    }
    next();
  }).catch(err => {
    console.error('API token authentication error:', err);
    next();
  });
}

// Role-based authorization middleware for API and UI
export function requireRole(roles: string[]) {
  return (req: Request, res: any, next: any) => {
    // Check if authenticated via session
    if (req.isAuthenticated() && req.user && roles.includes(req.user.role)) {
      return next();
    }
    
    // Check if authenticated via API token
    if (req.apiToken) {
      const hasPermission = req.apiToken.permissions.some(p => roles.includes(p));
      if (hasPermission) {
        return next();
      }
    }
    
    return res.status(403).json({ message: "Insufficient permissions" });
  };
}

// Function to find or create a user from external auth (LDAP/OIDC)
async function findOrCreateExternalUser(profile: any, source: string): Promise<User> {
  try {
    // Try to find user by email first
    const email = source === 'ldap' 
      ? profile.mail || profile.email 
      : profile.emails?.[0]?.value;
    
    if (!email) {
      throw new Error(`No email found in ${source} profile`);
    }
    
    let user = await storage.getUserByEmail(email);
    
    if (!user) {
      // No user found, create a new one if auto-registration is enabled
      if ((source === 'ldap' && CONFIG.LDAP_AUTO_REGISTER) || 
          (source === 'oidc' && CONFIG.OIDC_AUTO_REGISTER)) {
            
        // Generate username from email or name
        const username = source === 'ldap'
          ? profile.uid || profile.sAMAccountName || email.split('@')[0]
          : profile.displayName?.replace(/\s+/g, '.').toLowerCase() || email.split('@')[0];
        
        // Generate a secure random password (user won't know it, but we need something in the DB)
        const password = await hashPassword(randomBytes(32).toString('hex'));
        
        // Create the user
        user = await storage.createUser({
          username,
          email,
          password,
          role: "user",
          fullName: source === 'ldap' 
            ? profile.displayName || `${profile.givenName || ''} ${profile.sn || ''}`.trim()
            : profile.displayName || profile.name?.givenName
        });
      } else {
        throw new Error(`User with email ${email} not found and auto-registration is disabled`);
      }
    }
    
    return user;
  } catch (error) {
    console.error(`Error in findOrCreateExternalUser (${source}):`, error);
    throw error;
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'dynamidns-secret',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Apply API token authentication middleware before routes
  app.use(authenticateApiToken);

  // Initialize local auth strategy if enabled
  if (CONFIG.LOCAL_AUTH_ENABLED) {
    passport.use(
      new LocalStrategy(async (username, password, done) => {
        try {
          // Check if username is email format
          const isEmail = username.includes('@');
          
          let user;
          if (isEmail) {
            user = await storage.getUserByEmail(username);
          } else {
            user = await storage.getUserByUsername(username);
          }
          
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false);
          } else {
            return done(null, user);
          }
        } catch (error) {
          return done(error);
        }
      }),
    );
  }

  // Initialize LDAP strategy if enabled
  if (CONFIG.LDAP_ENABLED) {
    passport.use(new LdapStrategy({
      server: {
        url: CONFIG.LDAP_URL,
        bindDN: CONFIG.LDAP_BIND_DN,
        bindCredentials: CONFIG.LDAP_BIND_CREDENTIALS,
        searchBase: CONFIG.LDAP_SEARCH_BASE,
        searchFilter: CONFIG.LDAP_SEARCH_FILTER,
        searchAttributes: ['uid', 'mail', 'email', 'cn', 'displayName', 'givenName', 'sn', 'sAMAccountName']
      },
      usernameField: 'username',
      passwordField: 'password'
    }, async (profile, done) => {
      try {
        const user = await findOrCreateExternalUser(profile, 'ldap');
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }));
  }

  // Initialize OpenID Connect strategy if enabled
  if (CONFIG.OIDC_ENABLED) {
    passport.use('oidc', new OpenIDConnectStrategy({
      issuer: CONFIG.OIDC_ISSUER,
      authorizationURL: `${CONFIG.OIDC_ISSUER}/authorize`,
      tokenURL: `${CONFIG.OIDC_ISSUER}/token`,
      userInfoURL: `${CONFIG.OIDC_ISSUER}/userinfo`,
      clientID: CONFIG.OIDC_CLIENT_ID,
      clientSecret: CONFIG.OIDC_CLIENT_SECRET,
      callbackURL: CONFIG.OIDC_CALLBACK_URL,
      scope: CONFIG.OIDC_SCOPE.split(' ')
    }, async (issuer, profile, context, idToken, accessToken, refreshToken, done) => {
      try {
        const user = await findOrCreateExternalUser(profile, 'oidc');
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }));
  }

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // User registration validation schema
  const registerSchema = z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(8).max(100),
    email: z.string().email(),
    fullName: z.string().optional(),
    organizationId: z.string().uuid().optional()
  });

  // Registration endpoint
  app.post("/api/register", async (req, res, next) => {
    // Check if registration is disabled
    if (CONFIG.DISABLE_REGISTRATION) {
      return res.status(403).json({ message: "User registration is disabled" });
    }
    
    try {
      // Validate input
      const validatedData = registerSchema.parse(req.body);
      
      // Check if user exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      // Create user
      const user = await storage.createUser({
        ...validatedData,
        password: await hashPassword(validatedData.password),
        role: "user", // Default role
      });
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        next(error);
      }
    }
  });

  // Local auth login endpoint
  app.post("/api/login", (req, res, next) => {
    if (!CONFIG.LOCAL_AUTH_ENABLED) {
      return res.status(403).json({ message: "Local authentication is disabled" });
    }
    
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  // LDAP login endpoint
  app.post("/api/auth/ldap", (req, res, next) => {
    if (!CONFIG.LDAP_ENABLED) {
      return res.status(403).json({ message: "LDAP authentication is disabled" });
    }
    
    passport.authenticate("ldapauth", (err, user, info) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid LDAP credentials" });
      
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  // OIDC auth endpoints
  if (CONFIG.OIDC_ENABLED) {
    app.get("/api/auth/oidc", passport.authenticate("oidc"));
    
    app.get("/api/auth/oidc/callback", 
      passport.authenticate("oidc", { failureRedirect: "/auth" }),
      (req, res) => {
        res.redirect("/");
      }
    );
  }

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    
    // Remove password from response
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });
  
  // Authentication configuration endpoint - exposes auth options (but never secrets)
  app.get("/api/auth/config", (req, res) => {
    res.json({
      localAuthEnabled: CONFIG.LOCAL_AUTH_ENABLED,
      registrationEnabled: !CONFIG.DISABLE_REGISTRATION,
      ldapEnabled: CONFIG.LDAP_ENABLED,
      oidcEnabled: CONFIG.OIDC_ENABLED,
      oidcButtonText: CONFIG.OIDC_BUTTON_TEXT
    });
  });
  
  // Ensure admin user exists on server start
  ensureAdminUser();
}
