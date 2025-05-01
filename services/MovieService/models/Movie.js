const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  title: { type: String, required: true },
  director: String,
  actors: [String],
  duration: Number,
  nation: String,
  genres: [String],
  description: String ,
  releaseDate: { type: Date, required: true },
  age: {
    type: String,
    enum: ['unrated', 'P', 'T13', 'T16', 'T18'],
    default: 'unrated',
  },
  rating: {
    type: Number,
    min: 0,
    max: 10,
    default: 0,
  },
  poster: { type: String, required: true }, 
  trailer: String,
  status: {
    type: String,
    enum: ['now_showing', 'coming_soon'],
    default: 'coming_soon',
  },
  
}, { timestamps: true });

module.exports = mongoose.model('Movie', movieSchema);
