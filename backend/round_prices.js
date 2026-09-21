const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const PriceModel = require('./src/modules/pricing/price.model');
const MechanicServicePricing = require('./src/modules/mechanicServicePricing/mechanicServicePricing.model');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mecfinders');
    
    const roundPricing = async (Model) => {
        const prices = await Model.find({});
        for (const p of prices) {
            p.gstAmount = Math.round(p.gstAmount);
            p.totalPrice = Math.round(p.totalPrice);
            p.completePlatformFee = Math.round(p.completePlatformFee);
            await p.save();
        }
    };
    
    await roundPricing(PriceModel);
    await roundPricing(MechanicServicePricing);
    console.log('Prices rounded successfully!');
    process.exit(0);
}
run();
