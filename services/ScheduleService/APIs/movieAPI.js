//movieAPI
const axios = require("axios");
const MOVIE_SERVICE_BASE_URL = "http://localhost:5001/api/movies"; 

// Hàm gọi API từ MovieService để lấy thông tin phim
async function fetchMovieById(movieId) {
  try {
    const response = await axios.get(`${MOVIE_SERVICE_BASE_URL}/${movieId}`);
    return response.data;
  } catch (err) {
    console.error("Lỗi khi gọi API MovieService:", err.message);
    return null; 
  }
}

module.exports = { fetchMovieById };