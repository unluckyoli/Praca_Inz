import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  withCredentials: true,
});

const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expirationTime = payload.exp * 1000; 
    const currentTime = Date.now();
    
    return expirationTime < (currentTime + 5 * 60 * 1000);
  } catch (error) {
    return true;
  }
};

const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) {
    throw new Error("No refresh token");
  }

  const response = await axios.post(
    `${import.meta.env.VITE_API_URL || "http://localhost:3001/api"}/auth/refresh`,
    { refreshToken },
  );

  const { accessToken } = response.data;
  localStorage.setItem("accessToken", accessToken);
  return accessToken;
};

api.interceptors.request.use(
  async (config) => {
    let token = localStorage.getItem("accessToken");
    
    if (token && isTokenExpired(token)) {
      try {
        token = await refreshAccessToken();
      } catch (error) {
        console.error("Failed to refresh token:", error);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        return Promise.reject(error);
      }
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const token = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error("Failed to refresh token on 401:", refreshError);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  logout: () => {
    const refreshToken = localStorage.getItem("refreshToken");
    return api.post("/auth/logout", { refreshToken });
  },
  getCurrentUser: () => api.get("/auth/me"),
  refresh: (refreshToken) => api.post("/auth/refresh", { refreshToken }),
  unlinkStrava: () => api.post("/auth/strava/unlink"),
  googleAuth: () => api.get("/auth/google"),
  unlinkGoogle: () => api.post("/auth/google/unlink"),

  

  requestPasswordReset: (email) => api.post("/auth/forgot-password", { email }),
  resetPassword: ({ token, password }) => api.post("/auth/reset-password", { token, password }),


  initAuth: async () => {
    const token = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    
    if (!token && !refreshToken) {
      return false;
    }
    
    if (token && isTokenExpired(token)) {
      try {
        await refreshAccessToken();
      } catch (error) {
        console.error("Failed to refresh token on init:", error);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        return false;
      }
    }
    
    return true;
  },
};

export const activitiesAPI = {
  getActivities: (params) => api.get("/activities", { params }),
  getActivityById: (id) => api.get(`/activities/${id}`),
  getActivityTypes: () => api.get("/activities/types"),
  syncActivities: () => api.post("/activities/sync"),
  recalculatePaceData: () => api.post("/activities/recalculate-pace"),
  syncBestEfforts: () => api.post("/activities/sync-best-efforts"),
  fetchActivityDetails: (id) => api.post(`/activities/${id}/fetch-details`),
  batchFetchDetails: (limit) => api.post("/activities/batch-fetch-details", { limit }),
  batchFetchDetailsRange: (payload) => api.post("/activities/batch-fetch-details-range", payload),
};

export const analyticsAPI = {
  getDistribution: () => api.get("/analytics/distribution"),
  getWeeklyStats: (params) => api.get("/analytics/weekly-stats", { params }),
  getMonthlyTrends: (params) =>
    api.get("/analytics/monthly-trends", { params }),
  getIntensityDistribution: () => api.get("/analytics/intensity-distribution"),
  getProgress: (metric, period) =>
    api.get("/analytics/progress", { params: { metric, period } }),
  compareActivities: (firstId, secondId) =>
    api.get("/analytics/compare", { params: { firstId, secondId } }),
  getFitnessMetrics: (params) => api.get("/analytics/fitness-metrics", { params }),

  // Stage 3 analytics (accordion panels)
  getCalendarHeatmap: (params) => api.get("/analytics/calendar-heatmap", { params }),
  getRampRate: (params) => api.get("/analytics/ramp-rate", { params }),
  getAerobicEfficiency: (params) => api.get("/analytics/aerobic-efficiency", { params }),
  getTimePatterns: (params) => api.get("/analytics/time-patterns", { params }),
  getYearOverYear: (params) => api.get("/analytics/year-over-year", { params }),
  getPerformanceCurve: (params) => api.get("/analytics/performance-curve", { params }),
};

export const dataAPI = {
  getUserStats: () => api.get("/data/stats"),
  getLongestActivity: (metric, params) =>
    api.get("/data/longest-activity", { params: { metric, ...params } }),
  getHardestActivity: (params) =>
    api.get("/data/hardest-activity", { params }),
  getRecords: () => api.get("/data/records"),
  getAverages: (groupBy) => api.get("/data/averages", { params: { groupBy } }),
  getBestEfforts: (params) => api.get("/data/best-efforts", { params }),
};

export const trainingPlanAPI = {
  getRecommended: () => api.get("/training-plan/recommend"),
  getTemplates: (params) => api.get("/training-plan/templates", { params }),
  getPlanById: (id) => api.get(`/training-plan/${id}`),
  getSessionById: (id) => api.get(`/training-plan/session/${id}`),
  
  analyzeTraining: () => api.get("/training-plan/analyze"),
  generatePlan: (data) => api.post("/training-plan/generate", data),
  generatePlanSSE: (data, onProgress) => {
    const token = localStorage.getItem('accessToken');
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/training-plan/generate-sse`;
    
    return new Promise((resolve, reject) => {
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to start plan generation: ${response.status} ${response.statusText}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        const readStream = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              return;
            }
            
            const text = decoder.decode(value);
            const lines = text.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.substring(6));
                
                if (data.error) {
                  reject(new Error(data.error));
                  return;
                }
                
                if (data.complete) {
                  resolve(data.plan);
                  return;
                }
                
                if (data.progress !== undefined && onProgress) {
                  onProgress(data.progress, data.message);
                }
              }
            }
            
            readStream();
          }).catch(reject);
        };
        
        readStream();
      })
      .catch(reject);
    });
  },
  getMyPlans: () => api.get("/training-plan/my-plans"),
  getMyPlanById: (planId) => api.get(`/training-plan/my-plans/${planId}`),
  completeWorkout: (workoutId, data) => api.patch(`/training-plan/workout/${workoutId}/complete`, data),
  updateWorkout: (workoutId, data) => api.patch(`/training-plan/workout/${workoutId}`, data),
  deleteWorkout: (workoutId) => api.delete(`/training-plan/workout/${workoutId}`),
  addWorkout: (planId, data) => api.post(`/training-plan/my-plans/${planId}/workout`, data),
  updatePlanStatus: (planId, status) => api.patch(`/training-plan/my-plans/${planId}/status`, { status }),
  deletePlan: (planId) => api.delete(`/training-plan/my-plans/${planId}`),
  syncToCalendar: (planId) => api.post(`/training-plan/my-plans/${planId}/sync-to-calendar`),
  syncToTasks: (planId) => api.post(`/training-plan/my-plans/${planId}/sync-to-tasks`),
  recomputeWorkouts: (planId) => api.post(`/training-plan/my-plans/${planId}/recompute-workouts`),
};


export const goalsAPI = {
  getCurrent: () => api.get("/goals/current"),
  create: (payload) => api.post("/goals", payload),
  history: () => api.get("/goals/history"),
};


export default api;
