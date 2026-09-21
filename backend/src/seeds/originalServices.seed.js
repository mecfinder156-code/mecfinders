'use strict';

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const VehicleCategory = require('../modules/categories/category.model');
const City = require('../modules/cities/city.model');
const Service = require('../modules/services/service.model');
const PriceModel = require('../modules/pricing/price.model');

const GST_PERCENTAGE = 18;
const PLATFORM_FEE = 30;
// Example base prices for the original services
const BASE_PRICES = {
    'Full Servicing': 999,
    'Washing': 299,
    'Inspection and Diagnosis': 149
};

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

async function seedOriginalServices() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mecfinders');
        console.log('Connected to MongoDB');

        // 1. Ensure 5 Categories
        const categoriesData = [
            { name: 'Bike', emoji: '🏍️' },
            { name: 'Car', emoji: '🚗' },
            { name: 'Scooty', emoji: '🛵' },
            { name: 'Bus/Truck', emoji: '🚌' },
            { name: 'Auto', emoji: '🛺' }
        ];

        const categories = [];
        for (const c of categoriesData) {
            let cat = await VehicleCategory.findOne({ name: c.name });
            if (!cat) cat = await VehicleCategory.create(c);
            categories.push(cat);
        }
        console.log(`Ensured ${categories.length} categories.`);

        // 2. Ensure 2 Cities
        const citiesData = ['Mathura', 'Delhi'];
        const cities = [];
        for (const cityName of citiesData) {
            let city = await City.findOne({ name: cityName });
            if (!city) city = await City.create({ name: cityName });
            cities.push(city);
        }
        console.log(`Ensured ${cities.length} cities.`);

        // 3. For each Category x City, insert 3 original Services
        let count = 0;
        for (const cat of categories) {
            for (const city of cities) {
                const servicesData = [
                    { 
                        name: 'Full Servicing', 
                        desc: `Complete end-to-end full servicing for your ${cat.name}.`,
                        price: BASE_PRICES['Full Servicing']
                    },
                    { 
                        name: `${cat.name} Wash`, 
                        desc: `Deep cleaning and washing for your ${cat.name}.`,
                        price: BASE_PRICES['Washing']
                    },
                    { 
                        name: 'Inspection and Diagnosis', 
                        desc: `Thorough inspection and diagnosis to find issues with your ${cat.name}.`,
                        price: BASE_PRICES['Inspection and Diagnosis']
                    }
                ];

                for (let i = 0; i < servicesData.length; i++) {
                    const s = servicesData[i];
                    
                    // Upsert Service
                    let service = await Service.findOne({ name: s.name, vehicleCategoryId: cat._id, cityId: city._id });
                    if (!service) {
                        service = await Service.create({
                            name: s.name,
                            description: s.desc,
                            vehicleCategoryId: cat._id,
                            cityId: city._id,
                            displayOrder: i + 1
                        });
                    } else {
                        service.description = s.desc;
                        await service.save();
                    }

                    // Upsert Pricing
                    const pricingData = calculatePricing(s.price);
                    let pricing = await PriceModel.findOne({ serviceId: service._id });
                    if (!pricing) {
                        await PriceModel.create({
                            serviceId: service._id,
                            ...pricingData
                        });
                    } else {
                        Object.assign(pricing, pricingData);
                        await pricing.save();
                    }
                    count++;
                }
            }
        }

        console.log(`Successfully seeded ${count} Original Services (3 per Category/City combination)!`);
    } catch (err) {
        console.error('Seeding Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

seedOriginalServices();
