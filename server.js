// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Path to projects JSON
const projectsFile = path.join(__dirname, 'projects.json');

// Get all projects
app.get('/api/projects', (req, res) => {
  if (!fs.existsSync(projectsFile)) fs.writeFileSync(projectsFile, '[]');
  const data = JSON.parse(fs.readFileSync(projectsFile));
  res.json(data);
});

// Add new project
app.post('/api/projects', (req, res) => {
  const { title, description, image } = req.body;
  if(!title || !description || !image){
    return res.status(400).json({error:'All fields required'});
  }

  const newProject = { title, description, image };
  let projects = [];
  if (fs.existsSync(projectsFile)) {
    projects = JSON.parse(fs.readFileSync(projectsFile));
  }
  projects.push(newProject);
  fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2));
  res.json({message:'Project added successfully'});
});

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));