const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect('mongodb+srv://Cris87:Janis724@cluster0.r79rn7k.mongodb.net/spaziovitale?appName=Cluster0')
  .then(async () => {
    const User = mongoose.connection.collection('users');
    const hash = await bcrypt.hash('@dmin$2026%', 10);
    await User.updateOne({ email: 'spaziovitale.gerencia@gmail.com' }, { $set: { password: hash } });
    console.log('Password updated to @dmin$2026%');
    process.exit();
  })
  .catch(console.error);
