import { google } from 'googleapis';
import prisma from '../config/database.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback';


export const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
};


export const getAuthUrl = (userId) => {
  const oauth2Client = createOAuth2Client();
  
  const scopes = [
    'https://www.googleapis.com/auth/tasks',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    include_granted_scopes: true,
    state: userId,
  });
};


export const exchangeCodeForTokens = async (code) => {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

export const refreshAccessToken = async (refreshToken) => {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
};

export const getAuthenticatedClient = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiresAt: true,
    },
  });

  if (!user?.googleRefreshToken) {
    throw new Error('User not connected to Google');
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
    expiry_date: user.googleTokenExpiresAt?.getTime(),
  });

  if (user.googleTokenExpiresAt && user.googleTokenExpiresAt < new Date()) {
    const newTokens = await refreshAccessToken(user.googleRefreshToken);
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: newTokens.access_token,
        googleTokenExpiresAt: new Date(newTokens.expiry_date),
      },
    });

    oauth2Client.setCredentials(newTokens);
  }

  return oauth2Client;
};

export const getTasksClient = async (userId) => {
  const auth = await getAuthenticatedClient(userId);
  return google.tasks({ version: "v1", auth });
};

export const getOrCreateTaskList = async (userId, title, existingTaskListId = null) => {
  const tasks = await getTasksClient(userId);

  if (existingTaskListId) {
    try {
      const res = await tasks.tasklists.get({ tasklist: existingTaskListId });
      return res.data;
    } catch (e) {
      // fallthrough and create new list
    }
  }

  // Try to find by title (best-effort; title is not guaranteed unique)
  try {
    const listRes = await tasks.tasklists.list({ maxResults: 100 });
    const existing = (listRes.data.items || []).find((l) => l.title === title);
    if (existing) return existing;
  } catch {
    // ignore
  }

  const created = await tasks.tasklists.insert({
    requestBody: { title },
  });
  return created.data;
};

export const upsertTask = async (userId, taskListId, taskId, taskData) => {
  const tasks = await getTasksClient(userId);

  if (taskId) {
    try {
      const res = await tasks.tasks.patch({
        tasklist: taskListId,
        task: taskId,
        requestBody: taskData,
      });
      return res.data;
    } catch (e) {
      // fallthrough to create
    }
  }

  const res = await tasks.tasks.insert({
    tasklist: taskListId,
    requestBody: taskData,
  });
  return res.data;
};

export const deleteTask = async (userId, taskListId, taskId) => {
  if (!taskId) return;
  const tasks = await getTasksClient(userId);
  await tasks.tasks.delete({
    tasklist: taskListId,
    task: taskId,
  });
};

export const deleteTaskList = async (userId, taskListId) => {
  if (!taskListId) return;
  const tasks = await getTasksClient(userId);
  await tasks.tasklists.delete({
    tasklist: taskListId,
  });
};

export const createCalendarEvent = async (userId, eventData) => {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const event = {
    summary: eventData.summary,
    description: eventData.description,
    start: {
      dateTime: eventData.startTime,
      timeZone: 'Europe/Warsaw',
    },
    end: {
      dateTime: eventData.endTime,
      timeZone: 'Europe/Warsaw',
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 15 }, 
      ],
    },
    colorId: '9',
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });

  return response.data;
};


export const updateCalendarEvent = async (userId, eventId, eventData) => {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const event = {
    summary: eventData.summary,
    description: eventData.description,
    start: {
      dateTime: eventData.startTime,
      timeZone: 'Europe/Warsaw',
    },
    end: {
      dateTime: eventData.endTime,
      timeZone: 'Europe/Warsaw',
    },
  };

  const response = await calendar.events.update({
    calendarId: 'primary',
    eventId: eventId,
    requestBody: event,
  });

  return response.data;
};


export const deleteCalendarEvent = async (userId, eventId) => {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId,
  });
};

export default {
  getAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getAuthenticatedClient,
  getTasksClient,
  getOrCreateTaskList,
  upsertTask,
  deleteTask,
  deleteTaskList,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
};
