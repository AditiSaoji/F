const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const cors = require('cors');
const { ObjectId } = require('mongodb');
const nodemailer = require('nodemailer'); 
 

// Mail transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com', // Your email
        pass: 'your-email-password', // Your email password or app password if 2FA is enabled
    },
});

// Function to send the welcome email
async function sendWelcomeEmail(email, name) {
    const mailOptions = {
        from: 'your-email@gmail.com',
        to: email,
        subject: 'Welcome to Our Site!',
        text: `Hello ${name},\n\nWelcome to our site! We're glad to have you with us.\n\nBest regards,\nYour Team`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Welcome email sent successfully');
    } catch (error) {
        console.error('Error sending welcome email:', error);
    }
}

// Import models for Admin, User, and FoodItem
const models = require('./models'); // Import all models
const Admin = models.Admin; // Extract Admin
const User = models.User; // Extract User
const FoodItem = models.FoodItem; // Extract FoodItem
const Receipt = models.Receipt; // Extract Receipt


const app = express();
const port = 3003;

app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/mydatabase')
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the public folder
app.use(express.static('public'));

// Session management
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/foodOrder' }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// Middleware to check if admin is logged in
function isAuthenticated(req, res, next) {
    if (req.session.admin) {
        next();
    } else {
        res.redirect('/login.html'); // Redirect to login if not authenticated
    }
}

// Redirect root to login page
app.get('/', (req, res) => {
    res.redirect('/index.html'); // Redirect to login.html
});

// Admin registration
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const newAdmin = new Admin({ username, password: hashedPassword });
        await newAdmin.save();
        req.session.admin = username;
        res.redirect('/admin-home.html');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error registering admin.');
    }
});

// Admin login
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username });
        if (admin && await bcrypt.compare(password, admin.password)) {
            req.session.admin = username;
            res.redirect('/admin-home.html');
        } else {
            res.status(401).send('Invalid credentials');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error logging in.');
    }
});

/// User registration
app.post('/api/user/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();

        // Send the welcome email
        await sendWelcomeEmail(email, name); // Add this line

        res.json({ success: true, message: 'User registered successfully!' });
    } catch (error) {
        if (error.code === 11000) {
            res.json({ success: false, message: 'Email already registered.' });
        } else {
            res.json({ success: false, message: 'Registration failed. Please try again.' });
        }
    }
});


// User login (optional implementation)
app.post('/api/user/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user._id; // Store user ID in the session
            req.session.user = user; // Optionally store the entire user object
            res.json({ success: true, message: 'Login successful' });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error logging in.');
    }
});


// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login.html');
    });
});

app.get('/profile', async (req, res) => {
    try {
        const userId = req.session.userId; // Use session variable for user ID

        if (!userId) {
            return res.status(401).json({ message: 'User not logged in' });
        }

        const user = await User.findById(userId); // Fetch user from the database
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Return the user profile
        res.json({
            name: user.name, 
            email: user.email,
            
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Server error while fetching user profile' });
    }
});




// Add food item
app.post('/add-food', isAuthenticated, async (req, res) => {
    try {
        const { name, image, price, category } = req.body;
        const foodItem = new FoodItem({ name, image, price, category });
        await foodItem.save();
        res.status(200).send('Food item added');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error adding food item');
    }
});

// Delete a food item by ID
app.delete('/delete-item/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`Received request to delete item with ID: ${id}`);  // Log the received ID

    try {
        // Ensure the ID is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid ID format' });
        }

        // Attempt to delete the item using the Mongoose model
        const result = await FoodItem.findByIdAndDelete(id);

        if (result) {
            console.log(`Successfully deleted item with ID: ${id}`);
            res.json({ success: true, message: 'Item deleted successfully' });
        } else {
            console.log(`No item found with ID: ${id}`);
            res.status(404).json({ success: false, message: 'Item not found' });
        }
    } catch (error) {
        console.error('Error while deleting item:', error);
        res.status(500).json({ success: false, message: 'Server error occurred' });
    }
});


app.delete('/delete-item/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`Received request to delete item with ID: ${id}`);  // Log the ID
    
});

// Get all food items
app.get('/food-items', async (req, res) => {
    try {
        const foodItems = await FoodItem.find();
        res.json(foodItems);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching food items');
    }
});


app.post('/save-receipt', async (req, res) => {
    const { username, items, total } = req.body;

    // Validate the request body
    if (!username || !items || !total) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    try {
        const receipt = new Receipt({ username, items, total });
        await receipt.save(); // Save receipt to the database
        res.status(201).json({ message: 'Receipt saved successfully!', receipt });
    } catch (error) {
        console.error('Error saving receipt:', error);
        res.status(500).json({ message: 'Error saving receipt.', error });
    }
});


app.post('/orders', async (req, res) => {
    const { userId, items, total } = req.body;

    try {
        // Save the receipt first
        const receipt = new Receipt({
            username: userId, // or whatever your user identifier is
            items: items,
            total: total,
        });

        const savedReceipt = await receipt.save(); // Save receipt to the database

        
        // If payment is successful:
        res.status(201).json({ message: 'Order placed successfully!', receipt: savedReceipt });
        
        // If payment fails, handle that as well

    } catch (error) {
        console.error('Error saving receipt:', error);
        res.status(500).json({ message: 'Failed to save receipt' });
    }
});


app.get('/receipts/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const receipts = await Receipt.find({ username: userId }); // Find receipts by userId
        res.json(receipts);
    } catch (error) {
        console.error('Error fetching receipts:', error);
        res.status(500).json({ message: 'Failed to fetch receipts' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
