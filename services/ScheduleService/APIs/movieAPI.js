const axios = require("axios");
require("dotenv").config();
const MOVIE_SERVICE_BASE_URL = process.env.MOVIE_SERVICE_BASE_URL;

// Hàm gọi API từ MovieService để lấy thông tin phim
async function fetchMovieById(movieId) {
  try {
    console.log("MOVIE_SERVICE_BASE_URL:", MOVIE_SERVICE_BASE_URL);

    const response = await axios.get(`${MOVIE_SERVICE_BASE_URL}/${movieId}`, {
      timeout: 3000, // timeout 3s
    });
    return response.data;
  } catch (err) {
    if (err.response) {
      // server trả về lỗi (vd 404)
      console.error(
        `MovieService trả lỗi: ${err.response.status} - ${
          err.response.data?.error || err.message
        }`
      );
    } else if (err.code === "ECONNABORTED") {
      // timeout
      console.error("MovieService request timeout");
    } else {
      // lỗi mạng hoặc khác
      console.error("Lỗi khi gọi API MovieService:", err.message);
    }
    return null;
  }
}

module.exports = { fetchMovieById };
