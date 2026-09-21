'use strict';

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const VehicleCategory = require('../modules/categories/category.model');
const City = require('../modules/cities/city.model');
const MechanicService = require('../modules/mechanicServices/mechanicService.model');
const MechanicServicePricing = require('../modules/mechanicServicePricing/mechanicServicePricing.model');

const GST_PERCENTAGE = 18;
const PLATFORM_FEE = 30;

const calculatePricing = (basePrice) => {
    const gstAmount = (basePrice * GST_PERCENTAGE) / 100;
    const totalPrice = basePrice + gstAmount + PLATFORM_FEE;
    return {
        servicePrice: basePrice,
        gstPercentage: GST_PERCENTAGE,
        platformFee: PLATFORM_FEE,
        gstAmount,
        totalPrice,
        completePlatformFee: PLATFORM_FEE
    };
};

const bikeServices = [
    { name: 'Rear Brake Pad / Shoe Replacement', price: 143, desc: 'Replacement of worn or damaged rear brake pads or shoes.' },
    { name: 'Carburetor Cleaning', price: 149, desc: 'Dismantling and cleaning of the carburetor.' },
    { name: 'Chain Lubrication', price: 199, desc: 'Cleaning and lubricating the drive chain.' },
    { name: 'Engine Oil Replacement', price: 49, desc: 'Draining used engine oil and refilling with new oil.' },
    { name: 'Battery Replacement', price: 299, desc: 'Removal and fitting of a replacement battery.' },
    { name: 'Headlight Bulb Replacement', price: 49, desc: 'Replacement labour for a faulty headlight bulb.' },
    { name: 'Engine Inspection', price: 199, desc: 'Basic inspection of accessible engine-related components.' },
    { name: 'Front Brake Pad / Shoe Replacement', price: 99, desc: 'Replacement labour for worn or damaged front brake pads or shoes.' },
    { name: 'Brake Fluid Replacement', price: 49, desc: 'Draining old brake fluid and refilling.' },
    { name: 'Battery Check', price: 99, desc: 'Basic assessment of battery condition.' },
    { name: 'Coolant Fill / Replacement', price: 49, desc: 'Checking coolant level and topping up or replacing.' },
    { name: 'Spark Plug Replacement', price: 49, desc: 'Replacement labour for the spark plug.' },
    { name: 'Brake Lever Replacement', price: 49, desc: 'Replacement labour for a broken, bent or worn brake lever.' },
    { name: 'Clutch Lever Replacement', price: 49, desc: 'Replacement labour for a damaged clutch lever.' },
    { name: 'Clutch Cable Replacement / Adjustment', price: 43, desc: 'Replacement or adjustment labour for the clutch cable.' },
    { name: 'Indicator / Bulb / Unit Replacement', price: 99, desc: 'Replacement labour for a faulty indicator bulb or unit.' },
    { name: 'Air Filter Replacement', price: 49, desc: 'Replacement labour for the air filter.' },
    { name: 'Accelerator Cable Replacement', price: 150, desc: 'Replacement labour for a worn or damaged accelerator cable.' },
    { name: 'Chain Sprocket Replacement', price: 239, desc: 'Replacement labour for worn chain sprockets.' },
    { name: 'Horn Replacement', price: 99, desc: 'Replacement labour for a faulty horn.' },
    { name: 'Mirror Fitting', price: 49, desc: 'Fitting or tightening labour for rear-view mirrors.' },
    { name: 'Petrol Tank Cleaning', price: 189, desc: 'Cleaning labour for the petrol tank.' },
    { name: 'Fuel Injector Cleaning', price: 499, desc: 'Cleaning labour for the fuel injector.' }
];

const carServices = [
    { name: 'Consultation / Car Inspection', price: 149, desc: 'A mechanic visits the customer location to understand the complaint, inspect the vehicle.' },
    { name: 'Basic Periodic Service', price: 1999, desc: 'Essential routine maintenance intended to keep the vehicle basic service items checked.' },
    { name: 'Standard Periodic Service', price: 2799, desc: 'A more comprehensive periodic maintenance package with deeper inspection.' },
    { name: 'Premium Periodic Service', price: 3999, desc: 'Comprehensive doorstep periodic maintenance combining routine service.' },
    { name: 'Battery Jump Start', price: 399, desc: 'Emergency doorstep assistance for a vehicle that will not start.' },
    { name: 'Battery Replacement', price: 249, desc: 'Battery diagnosis and doorstep replacement of the vehicle battery.' },
    { name: 'Breakdown On-Spot Repair', price: 299, desc: 'Emergency roadside mechanic assistance for a vehicle that has stopped working.' }
];

async function seedData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mecfinders');
        console.log('Connected to MongoDB');

        // Ensure Categories
        let bikeCat = await VehicleCategory.findOne({ name: 'Bike' });
        if (!bikeCat) bikeCat = await VehicleCategory.create({ name: 'Bike', emoji: '🏍️' });

        let carCat = await VehicleCategory.findOne({ name: 'Car' });
        if (!carCat) carCat = await VehicleCategory.create({ name: 'Car', emoji: '🚗' });

        // Ensure City
        let city = await City.findOne({ name: 'Mathura' });
        if (!city) city = await City.create({ name: 'Mathura' });

        // Helper to insert services
        const insertServices = async (services, categoryId, cityId) => {
            for (let i = 0; i < services.length; i++) {
                const s = services[i];
                // Upsert Service
                let service = await MechanicService.findOne({ name: s.name, vehicleCategoryId: categoryId, cityId });
                if (!service) {
                    service = await MechanicService.create({
                        name: s.name,
                        description: s.desc,
                        vehicleCategoryId: categoryId,
                        cityId: cityId,
                        displayOrder: i + 1
                    });
                } else {
                    service.description = s.desc;
                    service.displayOrder = i + 1;
                    await service.save();
                }

                // Upsert Pricing
                const pricingData = calculatePricing(s.price);
                let pricing = await MechanicServicePricing.findOne({ mechanicServiceId: service._id });
                if (!pricing) {
                    await MechanicServicePricing.create({
                        mechanicServiceId: service._id,
                        ...pricingData
                    });
                } else {
                    Object.assign(pricing, pricingData);
                    await pricing.save();
                }
            }
        };

        console.log('Seeding Bike Services...');
        await insertServices(bikeServices, bikeCat._id, city._id);
        
        console.log('Seeding Car Services...');
        await insertServices(carServices, carCat._id, city._id);

        console.log('Successfully seeded all Mechanic Services and Pricing!');
    } catch (err) {
        console.error('Seeding Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

seedData();
