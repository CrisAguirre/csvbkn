const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'spaziovitale_super_secret_key_2026';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Cris87:Janis724@cluster0.r79rn7k.mongodb.net/spaziovitale?appName=Cluster0';

app.use(cors());
app.use(express.json());

// Database connection
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB (spaziovitale)');
    
    // Auto-seed admin user on startup
    try {
      const adminEmail = 'krontroth@gmail.com';
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
        
        return res.json({ 
            success: true, 
            token, 
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

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
