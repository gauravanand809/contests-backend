const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS
app.use(cors());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Coding Contests API',
    endpoints: {
      '/contests': 'Get all active contests from Codeforces, LeetCode, and CodeChef',
      '/contests/codeforces': 'Get active Codeforces contests',
      '/contests/leetcode': 'Get active LeetCode contests',
      '/contests/codechef': 'Get active CodeChef contests'
    }
  });
});

// Helper function to fetch Codeforces contests
async function fetchCodeforcesContests() {
  try {
    const response = await axios.get('https://codeforces.com/api/contest.list');
    
    if (response.data.status !== 'OK') {
      throw new Error('Failed to fetch Codeforces contests');
    }
    
    // Filter only active contests (phase === "BEFORE")
    const activeContests = response.data.result
      .filter(contest => contest.phase === 'BEFORE')
      .map(contest => ({
        platform: 'Codeforces',
        name: contest.name,
        startTimeUnix: contest.startTimeSeconds,
        startTime: new Date(contest.startTimeSeconds * 1000).toISOString(),
        durationSeconds: contest.durationSeconds,
        duration: `${Math.floor(contest.durationSeconds / 3600)} hours ${(contest.durationSeconds % 3600) / 60} minutes`,
        url: `https://codeforces.com/contests/${contest.id}`
      }));
    
    return activeContests;
  } catch (error) {
    console.error('Error fetching Codeforces contests:', error.message);
    return [];
  }
}

// Helper function to fetch LeetCode contests
async function fetchLeetcodeContests() {
  try {
    const graphqlQuery = {
      query: `
        query getContestList {
          allContests {
            title
            startTime
            duration
            titleSlug
          }
        }
      `
    };
    
    const response = await axios.post('https://leetcode.com/graphql', graphqlQuery, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const allContests = response.data.data.allContests;
    const now = Date.now();
    
    // Filter only active contests (start time is in the future)
    const activeContests = allContests
      .filter(contest => contest.startTime * 1000 > now)
      .map(contest => ({
        platform: 'LeetCode',
        name: contest.title,
        startTimeUnix: contest.startTime,
        startTime: new Date(contest.startTime * 1000).toISOString(),
        durationSeconds: contest.duration,
        duration: `${Math.floor(contest.duration / 3600)} hours ${(contest.duration % 3600) / 60} minutes`,
        url: `https://leetcode.com/contest/${contest.titleSlug}`
      }));
    
    return activeContests;
  } catch (error) {
    console.error('Error fetching LeetCode contests:', error.message);
    return [];
  }
}

// Helper function to fetch CodeChef contests
async function fetchCodechefContests() {
  try {
    const response = await axios.get('https://www.codechef.com/api/list/contests/all');
    
    if (!response.data.future_contests) {
      throw new Error('Failed to fetch CodeChef contests');
    }
    
    const activeContests = response.data.future_contests.map(contest => ({
      platform: 'CodeChef',
      name: contest.contest_name,
      code: contest.contest_code,
      startTimeUnix: Math.floor(new Date(contest.contest_start_date).getTime() / 1000),
      startTime: new Date(contest.contest_start_date).toISOString(),
      endTime: new Date(contest.contest_end_date).toISOString(),
      duration: calculateDuration(contest.contest_start_date, contest.contest_end_date),
      url: `https://www.codechef.com/${contest.contest_code}`
    }));
    
    return activeContests;
  } catch (error) {
    console.error('Error fetching CodeChef contests:', error.message);
    return [];
  }
}

// Helper function to calculate duration between two dates
function calculateDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationSeconds = Math.floor((end - start) / 1000);
  
  return `${Math.floor(durationSeconds / 3600)} hours ${(durationSeconds % 3600) / 60} minutes`;
}

// Endpoint to get all active contests
app.get('/contests', async (req, res) => {
  try {
    const [codeforces, leetcode, codechef] = await Promise.all([
      fetchCodeforcesContests(),
      fetchLeetcodeContests(),
      fetchCodechefContests()
    ]);
    
    const allContests = [...codeforces, ...leetcode, ...codechef].sort((a, b) => a.startTimeUnix - b.startTimeUnix);
    
    res.json({
      status: 'success',
      count: allContests.length,
      data: allContests
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Endpoint to get Codeforces contests
app.get('/contests/codeforces', async (req, res) => {
  try {
    const contests = await fetchCodeforcesContests();
    
    res.json({
      status: 'success',
      count: contests.length,
      data: contests
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Endpoint to get LeetCode contests
app.get('/contests/leetcode', async (req, res) => {
  try {
    const contests = await fetchLeetcodeContests();
    
    res.json({
      status: 'success',
      count: contests.length,
      data: contests
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Endpoint to get CodeChef contests
app.get('/contests/codechef', async (req, res) => {
  try {
    const contests = await fetchCodechefContests();
    
    res.json({
      status: 'success',
      count: contests.length,
      data: contests
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
