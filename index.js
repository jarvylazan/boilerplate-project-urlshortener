require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const dns = require('dns');
const bodyParser = require('body-parser');
const urlparser = require('url');

const app = express();
const port = process.env.PORT;

// MongoDB Configuration
const client = new MongoClient(process.env.MONGO_URI);
let urlsCollection;

async function connectToDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    const db = client.db("urlshortener");
    urlsCollection = db.collection("urls");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}
connectToDB();

// Middleware Config
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(`${process.cwd()}/public`));

// Serve the HTML file
app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// API endpoint: POST /api/shorturl
app.post('/api/shorturl', async (req, res) => {
  const origUrl = req.body.url;

  // Validate URL format
  let hostname;
  try {
    hostname = new URL(origUrl).hostname;
  } catch (error) {
    return res.json({ error: 'invalid url' });
  }

  // Perform DNS lookup
  dns.lookup(hostname, async (err, address) => {
    if (err || !address) {
      return res.json({ error: 'invalid url' });
    }

    try {
      // Create a new short URL and store it in the database
      const urlCount = await urlsCollection.countDocuments({});
      const shortUrl = urlCount + 1;

      const urlDoc = {
        original_url: origUrl,
        short_url: shortUrl,
      };

      await urlsCollection.insertOne(urlDoc);

      res.json({
        original_url: origUrl,
        short_url: shortUrl,
      });
    } catch (dbError) {
      console.error("Database error:", dbError);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// API endpoint: GET /api/shorturl/:short_url
app.get('/api/shorturl/:short_url', async (req, res) => {
  const shortUrl = parseInt(req.params.short_url, 10);

  if (isNaN(shortUrl)) {
    return res.json({ error: 'invalid short url' });
  }

  try {
    const urlDoc = await urlsCollection.findOne({ short_url: shortUrl });

    if (!urlDoc) {
      return res.json({ error: 'No URL found' });
    }

    res.redirect(urlDoc.original_url);
  } catch (error) {
    console.error("Error fetching URL:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
