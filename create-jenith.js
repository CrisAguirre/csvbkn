const mongoose = require('mongoose');
const Quotation = require('./models/Quotation');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Cris87:Janis724@cluster0.r79rn7k.mongodb.net/spaziovitale?appName=Cluster0';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    try {
      const admin = await User.findOne({ role: 'admin' });
      
      // Eliminar cotización existente si hay conflicto
      await Quotation.deleteOne({ number: 1152 });

      const quotation = new Quotation({
        number: 1152,
        date: new Date(),
        city: 'San Juan de Pasto',
        client: {
          name: 'JENITH HERNANDEZ',
          city: 'Pasto',
          phone: '',
          email: ''
        },
        title: 'VENTA, ELABORACION E INSTALACIÓN DE MOBILIARIO',
        wizardConfig: {
          clientPriceMode: 'proportional',
          hardwareDisplayMode: 'table',
          moTimeMode: 'table',
          requiresDesignFiles: false,
          designFilesInternal: false,
          areaDisplayMode: 'subtotals',
          mesonMode: 'special',
          wizardCompleted: true
        },
        status: 'nuevo',
        areas: [
          {
            name: 'BAÑOS',
            furniture: [
              {
                name: 'Mueble de baño alcoba principal',
                description: 'Mueble con mesón en quarztone',
                measurements: '1.20m x 0.80m',
                quantity: 1,
                type: 'custom',
                cuts: [{ description: 'Cortes varios', sqm: 2, timeHours: 1, quantity: 1, laborRate: 12495, totalPrice: 12495 }]
              }
            ],
            areaTotal: 500000
          },
          {
            name: 'CLOSETS',
            furniture: [
              {
                name: 'CLOSET ALC 2',
                measurements: '2.00m x 2.40m',
                quantity: 1,
                type: 'custom',
                assembly: [{ description: 'Armado closet', measurement: '4.8', unitOfMeasure: 'm2', assemblyHours: 4, persons: 2, totalQuantity: 8, laborRate: 12495, totalPrice: 99960 }]
              }
            ],
            areaTotal: 1500000
          },
          {
            name: 'CENTRO DE TV - ALC PRINCIPAL',
            furniture: [{ name: 'Pérgolas en melamina', quantity: 1, type: 'custom' }],
            areaTotal: 800000
          },
          {
            name: 'CENTRO DE TV - ALCOBA 2',
            furniture: [{ name: 'Tablero TV', quantity: 1, type: 'custom' }],
            areaTotal: 600000
          },
          {
            name: 'COCINA',
            furniture: [
              { 
                name: 'ISLA', 
                quantity: 1, 
                type: 'custom',
                accessories: [
                  { description: 'Bisagras cierre lento', quantity: 10, unitPrice: 5000, totalPrice: 50000 }
                ]
              }
            ],
            areaTotal: 2000000
          }
        ],
        totals: {
          totalCost: 5400000,
          unforeseenPercent: 10,
          unforeseenAmount: 540000,
          profitPercent: 35,
          profitAmount: 1890000,
          indirectPercent: 32,
          indirectAmount: 1728000,
          subtotal: 9558000,
          taxPercent: 19,
          taxAmount: 1816020,
          totalWithTax: 11374020,
          discountPercent: 0,
          discountAmount: 0,
          grandTotal: 11374020
        },
        createdBy: admin._id
      });
      
      await quotation.save();
      console.log('Cotización 1152 JENITH HERNANDEZ creada exitosamente en DB.');
      process.exit(0);
    } catch (e) {
      console.error('Error:', e);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Conexion DB fallida:', err);
    process.exit(1);
  });
