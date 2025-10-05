const express = require('express');
const app = express();
const path = require('path');

// Sert tout le dossier public
app.use(express.static(path.join(__dirname, 'public')));

// Sert Three.js
app.use('/build/', express.static(path.join(__dirname, 'node_modules/three/build')));
app.use('/jsm/', express.static(path.join(__dirname, 'node_modules/three/examples/jsm')));

// Forcer la racine à renvoyer index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(3000, () =>
  console.log('Visit http://127.0.0.1:3000')
);
