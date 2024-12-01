const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

const foodItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
});

const receiptSchema = new mongoose.Schema({
    username: { type: String, required: true },
    items: { type: Array, required: true }, 
    total: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now } 
});

const Receipt = mongoose.model('Receipt', receiptSchema);
const User = mongoose.model('User', userSchema);
const Admin = mongoose.model('Admin', adminSchema);
const FoodItem = mongoose.model('FoodItem', foodItemSchema);

module.exports = { Admin, User, FoodItem, Receipt };
