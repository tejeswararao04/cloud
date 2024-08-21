const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const app = express();

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Session setup
app.use(session({
    store: new SQLiteStore({ db: 'sessions.db', dir: './db' }),
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
const db = new sqlite3.Database('./db/adhar.db');

// Middleware to check authentication
function ensureAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next(); // User is authenticated, proceed to the next middleware or route
    }
    res.redirect('/login'); // User is not authenticated, redirect to login page
}

// Route for Login Page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/profile',ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// Route to get Aadhaar details for the authenticated user

// Route to update Aadhaar details
// Route to update Aadhaar details
app.post('/updateaadhaar', ensureAuthenticated, (req, res) => {
    const userId = req.session.userId;
    const { photo, address, phone, email } = req.body;

    // Initialize query and parameters
    let updateQuery = 'UPDATE adhar SET ';
    let params = [];

    // Add conditions based on provided data
    if (photo) {
        updateQuery += 'photo = ?, ';
        params.push(photo);
    }
    if (address) {
        updateQuery += 'dno = ?, street = ?, village = ?, district = ?, state = ?, pincode = ?, ';
        params.push(
            address.houseNo || '', 
            address.streetName || '', 
            address.villageName || '', 
            address.district || '', 
            address.state || '', 
            address.pincode || ''
        );
    }
    if (phone) {
        updateQuery += 'phn = ?, ';
        params.push(phone);
    }
    if (email) {
        updateQuery += 'emailid = ?, ';
        params.push(email);
    }

    // Remove trailing comma and space
    updateQuery = updateQuery.slice(0, -2);
    updateQuery += ' WHERE userid = ?';
    params.push(userId);

    // Execute the update query
    db.run(updateQuery, params, function (err) {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }

        res.json({ success: true, message: 'Aadhaar details updated successfully!' });
    });
});



// Route to get Aadhaar details
app.get('/getaadhaar', ensureAuthenticated, (req, res) => {
    const userId = req.session.userId;

    // Query the database for the user's Aadhaar details
    db.get('SELECT * FROM adhar WHERE userid = ?', [userId], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
        if (!row) {
            return res.json({ success: false, message: 'No Aadhaar data found' });
        }

        // Send the Aadhaar details as JSON
        res.json({
            success: true,
            aadhaarNumber: row.adharnumber,
            firstName: row.firstname,
            middleName: row.middlename,
            lastName: row.lastname,
            phone: row.phn,
            email: row.emailid,
            dob: row.dob,
            address: {
                houseNo: row.dno,
                streetName: row.street,
                villageName: row.village,
                district: row.district,
                pincode: row.pincode,
                state: row.state
            },
            photo: row.photo
        });
    });
});



// Login Handler
app.post('/login', (req, res) => {
    const { userid, password } = req.body;

    db.get('SELECT * FROM user WHERE userid = ?', [userid], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Server error');
        }
        if (!row) {
            return res.status(401).send('Invalid credentials');
        }

        // Directly compare plaintext passwords
        if (password === row.password) {
            req.session.userId = userid; // Store user ID in session
            res.json({ success: true });
        } else {
            res.status(401).send('Invalid credentials');
        }
    });
});

// Route for Signup Page
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});
app.post('/signup', (req, res) => {
    console.log("New signup")
    const { userid, password } = req.body;
    console.log(req.body)
    db.get('INSERT INTO user (userid, password) VALUES (?, ?)', [userid, password], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Server error');
        }
        if (row)
            console.log("Done");
        return res.status(200).send("Successfully registered");
    });
});

// Route for Create Aadhaar Page
app.post('/createaadhaar', ensureAuthenticated, (req, res) => {
    const userId = req.session.userId;

    const {
        aadhaarNumber,
        firstName,
        middleName,
        lastName,
        phone,
        email,
        dob,
        address: { houseNo, streetName, villageName, district, pincode, state },
        photo
    } = req.body;

    const query = `INSERT INTO adhar (
        adharnumber, firstname, middlename, lastname,
        phn, emailid, dob, dno, street,
        village, district, pincode, state, photo, userid
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(query, [
        aadhaarNumber, firstName, middleName, lastName,
        phone, email, dob, houseNo, streetName,
        villageName, district, pincode, state, photo, userId
    ], function (err) {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
        res.json({ success: true });
    });
});


// Route to delete Aadhaar details
app.post('/deleteaadhaar', ensureAuthenticated, (req, res) => {
    const userId = req.session.userId;

    // Delete query
    const deleteQuery = 'DELETE FROM adhar WHERE userid = ?';

    // Execute the delete query
    db.run(deleteQuery, [userId], function (err) {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ success: false, message: 'Server error' });
        }

        res.json({ success: true, message: 'Aadhaar details deleted successfully!' });
    });
});


// Route for View Aadhaar Page
app.get('/viewaadhar', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'view_aadhaar.html'));
});

// Route for Update Aadhaar Page
app.get('/updateaadhar', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'update_aadhaar.html'));
});

// Route for Delete Aadhaar Page
app.get('/deleteaadhar', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'delete_aadhaar.html'));
});

// Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            return res.status(500).send('Server error');
        }
        res.redirect('/login');
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
