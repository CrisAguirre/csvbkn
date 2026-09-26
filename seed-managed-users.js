const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Admin que NUNCA se borra. Password UNICO valido: hash bcrypt(10) fijo.
// El plaintext NO se guarda en codigo ni en env.
// Para rotar: genera nuevo hash con bcrypt.hashSync('NUEVA',10)
// y reemplaza KEEP_ADMIN_PASSWORD_HASH.
const KEEP_ADMIN = 'spaziovitale.gerencia@gmail.com';
const KEEP_ADMIN_PASSWORD_HASH = '$2b$10$Inc2Sk203QqHuVNrnD4j5uiFmtNG/vtpzOawLOAH/aMQOTHcFebR.';

// Cuentas gestionadas: email + password inicial + rol.
// Password puede sobreescribirse por env en Render sin cambiar codigo:
//   COMERCIAL_PASSWORD, CONTABILIDAD1_PASSWORD, CONTABILIDAD2_PASSWORD, DISENO_PASSWORD
const MANAGED_USERS = [
  { email: 'comercial@spaziovitale.com', password: process.env.COMERCIAL_PASSWORD || 'Spazio20261*', role: 'comercial' },
  { email: 'contabilidad1@spaziovitale.com', password: process.env.CONTABILIDAD1_PASSWORD || 'Spazio20262*', role: 'contabilidad' },
  { email: 'contabilidad2@spaziovitale.com', password: process.env.CONTABILIDAD2_PASSWORD || 'Spazio20263*', role: 'contabilidad' },
  { email: 'diseno@spaziovitale.com', password: process.env.DISENO_PASSWORD || 'Spazio20264*', role: 'diseno' },
];

async function seedManagedUsers() {
  const keepEmails = [KEEP_ADMIN.toLowerCase(), ...MANAGED_USERS.map((u) => u.email.toLowerCase())];

  // 1. Eliminar cualquier cuenta que no sea la admin conservada ni las 4 gestionadas
  const del = await User.deleteMany({ email: { $nin: keepEmails } });
  if (del.deletedCount > 0) {
    console.log('Managed users seed: eliminados ' + del.deletedCount + ' usuarios fuera de la lista permitida.');
  } else {
    console.log('Managed users seed: no habia usuarios extra para eliminar.');
  }

  // 2. Forzar admin unico: crear si falta, o resetear password+rol si existe.
  // Prioridad absoluta al hash fijo: ignora ADMIN_* / DESIGNER_* y cualquier valor previo en DB.
  const adminExisting = await User.findOne({ email: KEEP_ADMIN.toLowerCase() });
  if (!adminExisting) {
    await User.create({ email: KEEP_ADMIN.toLowerCase(), password: KEEP_ADMIN_PASSWORD_HASH, role: 'admin' });
    console.log('Managed users seed: creado admin ' + KEEP_ADMIN + ' con hash fijo.');
  } else if (adminExisting.password !== KEEP_ADMIN_PASSWORD_HASH || adminExisting.role !== 'admin') {
    adminExisting.password = KEEP_ADMIN_PASSWORD_HASH;
    adminExisting.role = 'admin';
    await adminExisting.save();
    console.log('Managed users seed: admin ' + KEEP_ADMIN + ' reseteado a hash fijo + rol admin.');
  } else {
    console.log('Managed users seed: admin OK (hash fijo + rol admin).');
  }

  // 3. Crear o actualizar (password + rol) las 4 cuentas gestionadas
  // Seguridad: ninguna gestionada puede suplantar al admin (mismo email o rol admin se ignora).
  for (const u of MANAGED_USERS) {
    const email = u.email.toLowerCase();
    if (email === KEEP_ADMIN.toLowerCase() || u.role === 'admin') {
      console.log('Managed users seed: IGNORADO ' + email + ' (no se permite duplicar admin).');
      continue;
    }
    const existing = await User.findOne({ email });
    const hashed = await bcrypt.hash(u.password, 10);
    if (!existing) {
      await User.create({ email, password: hashed, role: u.role });
      console.log('Managed users seed: creado ' + email + ' con rol ' + u.role + '.');
    } else {
      existing.password = hashed;
      existing.role = u.role;
      await existing.save();
      console.log('Managed users seed: actualizado ' + email + ' (password reseteado, rol ' + u.role + ').');
    }
  }
}

module.exports = seedManagedUsers;
