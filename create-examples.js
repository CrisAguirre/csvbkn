const mongoose = require('mongoose');
const Quotation = require('./models/Quotation');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Cris87:Janis724@cluster0.r79rn7k.mongodb.net/spaziovitale?appName=Cluster0';

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Conectado a MongoDB.');

  try {
    const admin = await User.findOne({ role: 'admin' });
    
    // Eliminar posibles cotizaciones previas con estos números
    await Quotation.deleteMany({ number: { $in: [2604, 2610] } });

    // COTIZACION COMPLEJA - 2604
    const quoteCompleja = new Quotation({
      number: 2604,
      date: new Date('2026-01-31T12:00:00Z'),
      city: 'San Juan de Pasto',
      client: {
        name: 'RICARDO',
        city: 'San Juan de Pasto',
        phone: '',
        email: ''
      },
      title: 'VENTA, ELABORACION E INSTALACIÓN DE MOBILIARIO',
      wizardConfig: {
        clientPriceMode: 'proportional',
        hardwareDisplayMode: 'table',
        areaDisplayMode: 'subtotals'
      },
      totals: {
        totalCost: 17793654,
        subtotal: 17793654,
        taxAmount: 0,
        discountAmount: 0, 
        grandTotal: 17793654,
        pricePerSqm: 0
      },
      notes: '',
      paymentTerms: 'ABONO INICIAL DEL 60% en efectivo... ABONO INICIAL DEL 35%... PAGO SALDO: 5%',
      validityDays: 3,
      areas: [
        {
          name: 'COCINA',
          furniture: [
            { name: 'COCINA INTEGRAL', description: 'VARIAS', measurements: '1 SERVICIO', quantity: 1, type: 'custom', totalCost: 10155069 }
          ],
          areaTotal: 10155069
        },
        {
          name: 'ACCESORIOS',
          furniture: [
            { name: 'KIT BISAGRA MASTER PARCHE', description: '1101010144', measurements: '33 UNIDAD', quantity: 33, type: 'custom', totalCost: 500000 },
            { name: 'CAJON OMEGABOX H68 500MM', description: '04603.500W', measurements: '2 UNIDAD', quantity: 2, type: 'custom', totalCost: 300000 },
            { name: 'CAJON OMEGABOX H151 501MM', description: '04603.501W', measurements: '1 UNIDAD', quantity: 1, type: 'custom', totalCost: 200000 },
            { name: 'JUEGO DE LOCERO INOX MOD 60', description: 'SJ304A', measurements: '1 UNIDAD', quantity: 1, type: 'custom', totalCost: 200000 },
            { name: 'BOTELLERO LATERAL 2 NIV', description: '2426DER', measurements: '1 UNIDAD', quantity: 1, type: 'custom', totalCost: 250000 },
            { name: 'CUBERTERO PLÁSTICO', description: 'TFC600A', measurements: '1 UNIDAD', quantity: 1, type: 'custom', totalCost: 100000 },
            { name: 'OTROS HERRAJES Y LED', description: 'Cintas, perfiles, zócalos', measurements: 'Varios', quantity: 1, type: 'custom', totalCost: 514985 }
          ],
          areaTotal: 2064985
        },
        {
          name: 'MESON QUARZTONE BLANCO POLAR',
          furniture: [
            { name: 'MESON', description: '410 X 60', measurements: '4.1 ML', quantity: 1, type: 'custom', totalCost: 3000000 },
            { name: 'SALPICADERO', description: '314 X 60', measurements: '3.14 ML', quantity: 1, type: 'custom', totalCost: 1500000 },
            { name: 'PATA CASCADA', description: '90 X 60', measurements: '0.9 ML', quantity: 1, type: 'custom', totalCost: 500000 },
            { name: 'CORTES Y BRILLADO DE MESON', description: 'CORBRI', measurements: '1 SER', quantity: 1, type: 'custom', totalCost: 573600 }
          ],
          areaTotal: 5573600
        }
      ],
      createdBy: admin ? admin._id : null
    });

    // COTIZACION FACIL - 2610
    const quoteFacil = new Quotation({
      number: 2610,
      date: new Date('2026-03-26T12:00:00Z'),
      city: 'San Juan de Pasto',
      client: {
        name: 'ANDREA RESTREPO',
        city: 'San Juan de Pasto',
        phone: '',
        email: ''
      },
      title: 'INSTALACIÓN DE LAMPARAS Y TOUCH',
      wizardConfig: {
        clientPriceMode: 'proportional',
        hardwareDisplayMode: 'table',
        areaDisplayMode: 'single'
      },
      totals: {
        totalCost: 350000,
        subtotal: 350000,
        taxAmount: 0,
        discountAmount: 0,
        grandTotal: 350000,
        pricePerSqm: 0
      },
      notes: '',
      paymentTerms: 'Al finalizar la instalación se hará el pago en efectivo o aL NEQUI 3008242382',
      validityDays: 3,
      areas: [
        {
          name: 'NOMBRE DEL MUBLE',
          furniture: [
            { name: 'INSTALACION DE LAMPARA', description: '', measurements: '1 SERVICIO', quantity: 1, type: 'custom', totalCost: 150000 },
            { name: 'INSTALACIÓN DE TOUCH', description: '', measurements: '2 UNIDADES', quantity: 2, type: 'custom', totalCost: 200000 }
          ],
          areaTotal: 350000
        }
      ],
      createdBy: admin ? admin._id : null
    });

    await quoteCompleja.save();
    console.log('Cotización 2604 (Compleja) guardada con éxito.');
    await quoteFacil.save();
    console.log('Cotización 2610 (Fácil) guardada con éxito.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

run();