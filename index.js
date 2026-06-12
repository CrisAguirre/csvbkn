const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Config = require('./models/Config');
const Activity = require('./models/Activity');

// Importar rutas
const materialsRoutes = require('./routes/materials');
const configRoutes = require('./routes/config');
const quotationsRoutes = require('./routes/quotations');
const laborRoutes = require('./routes/labor');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'spaziovitale_super_secret_key_2026';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Cris87:Janis724@cluster0.r79rn7k.mongodb.net/spaziovitale?appName=Cluster0';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Database connection
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB (spaziovitale)');
    
    // Auto-seed admin user on startup
    try {
      const adminEmail = 'spaziovitale.gerencia@gmail.com';
      const existingAdmin = await User.findOne({ email: adminEmail });
      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash('@dmin$2026%', 10);
        await User.create({
          email: adminEmail,
          password: hashedPassword,
          role: 'admin'
        });
        console.log(`Admin user ${adminEmail} seeded successfully.`);
      } else {
        console.log(`Admin user ${adminEmail} already exists in DB.`);
      }
    } catch (seedError) {
      console.error('Error seeding admin user:', seedError);
    }

    // Auto-seed designer user on startup
    try {
      const designerEmail = 'crisaguirredev@gmail.com';
      const existingDesigner = await User.findOne({ email: designerEmail });
      if (!existingDesigner) {
        const hashedPassword = await bcrypt.hash('D3sign@2026$', 10);
        await User.create({
          email: designerEmail,
          password: hashedPassword,
          role: 'designer'
        });
        console.log(`Designer user ${designerEmail} seeded successfully.`);
      } else {
        console.log(`Designer user ${designerEmail} already exists in DB.`);
      }
    } catch (seedError) {
      console.error('Error seeding designer user:', seedError);
    }

    // Auto-seed global config
    try {
      const existingConfig = await Config.findOne({ key: 'global' });
      if (!existingConfig) {
        await Config.create({
          key: 'global',
          laborRatePerHour: 12495,
          designRatePerHour: 16780,
          unforeseenPercent: 10,
          profitPercent: 35,
          indirectPercent: 32,
          taxPercent: 19,
          defaultDiscount: 10,
          nextQuotationNumber: 2700,
          wasteTable: [
            { minMl: 1, maxMl: 10, factor: 0.5 },
            { minMl: 11, maxMl: 30, factor: 0.35 },
            { minMl: 31, maxMl: 50, factor: 0.3 },
            { minMl: 51, maxMl: 100, factor: 0.25 }
          ]
        });
        console.log('Global config seeded successfully.');
      } else {
        console.log('Global config already exists in DB.');
      }
    } catch (configError) {
      console.error('Error seeding config:', configError);
    }
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// Login Endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Correo electrónico no encontrado' 
            });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ 
                success: false, 
                message: 'Contraseña incorrecta' 
            });
        }

        // Generate token
        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '8h' });
        
        // Log activity if not admin
        if (user.role !== 'admin') {
            await Activity.create({
                userEmail: user.email,
                role: user.role,
                action: 'login'
            });
        }
        
        return res.json({ 
            success: true, 
            token, 
            user: {
                email: user.email,
                role: user.role
            },
            message: 'Inicio de sesión exitoso' 
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error en el servidor al intentar iniciar sesión' 
        });
    }
});

// Register endpoint (solo admin puede crear usuarios)
const { authMiddleware, requireAdmin } = require('./middleware/auth');

app.post('/api/register', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { email, password, role } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'El correo ya está registrado.' });
        }

        const validRoles = ['admin', 'designer'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, message: 'Rol no válido. Use: admin o designer.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ email, password: hashedPassword, role });

        res.status(201).json({
            success: true,
            message: `Usuario ${email} creado con rol ${role}.`,
            data: { email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// API Routes
app.use('/api/materials', materialsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/quotations', quotationsRoutes);
app.use('/api/labor-times', laborRoutes);

// Actividad Endpoint
app.get('/api/activities', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const activities = await Activity.find().sort({ timestamp: -1 }).limit(100);
        res.json({ success: true, data: activities });
    } catch (error) {
        console.error('Activities error:', error);
        res.status(500).json({ success: false, message: 'Error al obtener actividades' });
    }
});

// Logout Endpoint
app.post('/api/logout', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            await Activity.create({
                userEmail: req.user.email,
                role: req.user.role,
                action: 'logout'
            });
        }
        res.json({ success: true, message: 'Sesión cerrada correctamente' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, message: 'Error al registrar salida' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
