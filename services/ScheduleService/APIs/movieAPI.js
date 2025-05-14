//movieAPI
const axios = require("axios");
const MOVIE_SERVICE_BASE_URL = "http://localhost:5001/api/movies"; // Giả sử MovieService đang chạy trên port 5001

// Hàm gọi API từ MovieService để lấy thông tin phim
async function fetchMovieById(movieId) {
  try {
    const response = await axios.get(`${MOVIE_SERVICE_BASE_URL}/${movieId}`);
    return response.data; // Giả sử MovieService trả về thông tin phim
  } catch (err) {
    console.error("Lỗi khi gọi API MovieService:", err.message);
    return null; // Nếu có lỗi, trả về null
  }
}

module.exports = { fetchMovieById };