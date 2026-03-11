const runtimeConfig = window.WESO_FIREBASE_CONFIG || {};

const read = (key) => {
  const value = runtimeConfig[key];
  return typeof value === "string" ? value.trim() : "";
};

export const firebaseConfig = {
  apiKey: read("apiKey") || "REPLACE_ME",
  authDomain: read("authDomain") || "REPLACE_ME",
  projectId: read("projectId") || "wesoamochildcancer",
  storageBucket: read("storageBucket") || "REPLACE_ME",
  messagingSenderId: read("messagingSenderId") || "REPLACE_ME",
  appId: read("appId") || "REPLACE_ME"
};
