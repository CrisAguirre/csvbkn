const mongoose = require('mongoose');
const Quotation = require('./models/Quotation');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Cris87:Janis724@cluster0.r79rn7k.mongodb.net/spaziovitale?appName=Cluster0';

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Conectado a MongoDB.');

  try {
    const admin = await User.findOne({ role: 'admin' });
    
    // Eliminar las anteriores para limpiar (1152, 1152A, 1152B)
    await Quotation.deleteMany({ number: { $in: [1152, 11521, 11522] } });

    // COTIZACION A - 1152 M (Mobiliario)
    const quoteA = new Quotation({
      number: 11521,
      date: new Date('2025-08-29T12:00:00Z'),
      city: 'Pasto',
      client: {
        name: 'JENITH HERNANDEZ (Mobiliario General)',
        city: 'Pasto',
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
        totalCost: 42544237, // Esto asegura markupFactor = 1
        subtotal: 42544237,
        taxAmount: 0,
        discountAmount: 0, 
        grandTotal: 42544237,
        pricePerSqm: 0
      },
      notes: 'Total de la cotización: $42.544.237. Descuento aplicado: -$2.107.301. TOTAL FINAL A PAGAR: $40.436.936',
      paymentTerms: 'ABONO INICIAL DEL 60% en efectivo... ABONO INICIAL DEL 35%... PAGO SALDO: 5%',
      validityDays: 3,
      areas: [
        {
          name: 'MUEBLES DE BAÑO',
          furniture: [
            { name: 'MUEBLE DE BAÑO ALC PRINC.', description: '70x30x50', measurements: '0.80 ML', quantity: 1, type: 'custom', totalCost: 1000000 },
            { name: 'ENTREPAÑO BAJO BAÑO', description: '70x50', measurements: '0.80 ML', quantity: 1, type: 'custom', totalCost: 500000 },
            { name: 'MUEBLE BAÑO SOCIAL', description: '70x30x50', measurements: '0.80 ML', quantity: 1, type: 'custom', totalCost: 1000000 },
            { name: 'ENTREPAÑO BAJO SOCIAL', description: '70x50', measurements: '0.80 ML', quantity: 1, type: 'custom', totalCost: 500000 },
            { name: 'MESON QUARZTONE BLANCO', description: '160x50', measurements: '1.6 ML', quantity: 1, type: 'custom', totalCost: 328897 }
          ],
          areaTotal: 3328897
        },
        {
          name: 'CLOSETS',
          furniture: [
            { name: 'CLOSET ALC 2', description: '133X224', measurements: '2.98 M2', quantity: 1, type: 'custom', totalCost: 4000000 },
            { name: 'MUEBLE SUPERIOR IZQ', description: '150X60', measurements: '0.90 M2', quantity: 1, type: 'custom', totalCost: 1000000 },
            { name: 'ESCRITORIO DOS CAJONES', description: '93X15X60', measurements: '0.93 ML', quantity: 1, type: 'custom', totalCost: 433469 }
          ],
          areaTotal: 5433469
        },
        {
          name: 'CENTRO DE TV - ALC PRINCIPAL',
          furniture: [{ name: 'CENTRO DE TV ALC PRINCIPAL', description: 'Pergolas, tablero, espejos, escritorio', measurements: 'Varios', quantity: 1, type: 'custom', totalCost: 5542044 }],
          areaTotal: 5542044
        },
        {
          name: 'CENTRO DE TV - ALCOBA 2',
          furniture: [{ name: 'CENTRO DE TV ALCOBA 2', description: 'Pergolas, tablero, mueble flotante', measurements: 'Varios', quantity: 1, type: 'custom', totalCost: 2865536 }],
          areaTotal: 2865536
        },
        {
          name: 'CENTRO DE TV - SALA',
          furniture: [{ name: 'CENTRO DE TV SALA', description: 'Pergolas, tablero, torres, puertas', measurements: 'Varios', quantity: 1, type: 'custom', totalCost: 5843431 }],
          areaTotal: 5843431
        },
        {
          name: 'MUEBLE PARED',
          furniture: [{ name: 'MUEBLE PARED', description: 'Estructura en melamina 15mm', measurements: '1.36 M2', quantity: 1, type: 'custom', totalCost: 658939 }],
          areaTotal: 658939
        },
        {
          name: 'VESTIER',
          furniture: [{ name: 'VESTIER COMPLETO', description: 'Vestier, perfileria, zapatero, cajones', measurements: 'Varios', quantity: 1, type: 'custom', totalCost: 15354697 }],
          areaTotal: 15354697
        },
        {
          name: 'PUERTAS SIN CHAPAS',
          furniture: [{ name: 'PUERTAS', description: 'Baño social, alcoba 2, baño alcoba', measurements: 'Varios', quantity: 3, type: 'custom', totalCost: 3517224 }],
          areaTotal: 3517224
        }
      ],
      createdBy: admin ? admin._id : null
    });

    // COTIZACION B - 1152 (Cocina)
    const quoteB = new Quotation({
      number: 11522,
      date: new Date('2025-08-29T12:00:00Z'),
      city: 'Pasto',
      client: {
        name: 'JENITH HERNANDEZ (Cocina)',
        city: 'Pasto',
        phone: '',
        email: ''
      },
      title: 'VENTA, ELABORACION E INSTALACIÓN DE MUEBLES DE COCINA',
      wizardConfig: {
        clientPriceMode: 'proportional',
        hardwareDisplayMode: 'table', // Separated table for accessories
        areaDisplayMode: 'subtotals'
      },
      totals: {
        totalCost: 31548756,
        subtotal: 31548756,
        taxAmount: 0,
        discountAmount: 0,
        grandTotal: 31548756,
        pricePerSqm: 0
      },
      notes: 'Total cotización: $31.548.756. Descuento: -$1.253.784. TOTAL FINAL A PAGAR: $30.294.972. No incluye instalaciones hidráulicas, eléctricas ni grifería.',
      paymentTerms: 'ABONO INICIAL DEL 60%... ABONO INICIAL DEL 35%... PAGO SALDO: 5%',
      validityDays: 3,
      areas: [
        {
          name: 'MUEBLES DE COCINA',
          furniture: [
            { 
              name: 'MUEBLE BAJO', 
              description: '297 X 78,5 X 60', 
              measurements: '2.97 ML', 
              quantity: 1, 
              type: 'custom', 
              totalCost: 14332435, 
              totalAccessories: 10266722, // hardware is subtracted if mode is table
              accessories: [
                { description: 'KIT BISAGRA MASTER', quantity: 18, totalPrice: 1000000, unitPrice: 0 },
                { description: 'BOTELLERO LATERAL', quantity: 1, totalPrice: 500000, unitPrice: 0 },
                { description: 'CAJON FLOWBOX', quantity: 4, totalPrice: 4000000, unitPrice: 0 },
                { description: 'OTROS HERRAJES', quantity: 1, totalPrice: 4766722, unitPrice: 0 }
              ]
            }
          ],
          areaTotal: 24599157
        },
        {
          name: 'MESON QUARTZON BLANCO EXTRA',
          furniture: [
            { name: 'MESON', description: '275 X 65', measurements: '2.98 ML', quantity: 1, type: 'custom', totalCost: 3000000 },
            { name: 'MESON - SALPICADERO', description: '275 X 60', measurements: '2.98 ML', quantity: 1, type: 'custom', totalCost: 2000000 },
            { name: 'MESON - ISLA', description: '', measurements: '1.9 ML', quantity: 1, type: 'custom', totalCost: 1500000 },
            { name: 'PERFORACIÓN ESPECIAL', description: '', measurements: '1 UNID', quantity: 1, type: 'custom', totalCost: 449600 }
          ],
          areaTotal: 6949600
        }
      ],
      createdBy: admin ? admin._id : null
    });

    await quoteA.save();
    console.log('Cotización 1152-A (Mobiliario) guardada con éxito.');
    await quoteB.save();
    console.log('Cotización 1152-B (Cocina) guardada con éxito.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

run();
