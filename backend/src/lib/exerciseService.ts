import axios from "axios";

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY!;
const BASE_URL = "https://exercisedb.p.rapidapi.com";

const headers = {
  "X-RapidAPI-Key": RAPIDAPI_KEY,
  "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
};

export interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string
  instructions: string[];
  secondaryMuscles: string[];
  difficulty?: string;
  category?: string;
}

// Obtener todos los ejercicios (con límite y offset)
export const getExercises = async (
  limit = 20,
  offset = 0
): Promise<Exercise[]> => {
  const response = await axios.get(`${BASE_URL}/exercises`, {
    headers,
    params: { limit, offset },
  });
  return response.data;
};

// Buscar ejercicios por nombre
export const searchExercises = async (
  name: string
): Promise<Exercise[]> => {
  const response = await axios.get(
    `${BASE_URL}/exercises/name/${encodeURIComponent(name.toLowerCase())}`,
    { headers }
  );
  return response.data;
};

// Obtener ejercicios por parte del cuerpo
export const getExercisesByBodyPart = async (
  bodyPart: string
): Promise<Exercise[]> => {
  const response = await axios.get(
    `${BASE_URL}/exercises/bodyPart/${bodyPart}`,
    { headers, params: { limit: 50 } }
  );
  return response.data;
};

// Obtener todas las partes del cuerpo disponibles
export const getBodyParts = async (): Promise<string[]> => {
  const response = await axios.get(`${BASE_URL}/exercises/bodyPartList`, {
    headers,
  });
  return response.data;
};

// Obtener imagen de un ejercicio como buffer
export const getExerciseImage = async (exerciseId: string): Promise<{ data: Buffer; contentType: string }> => {
  const response = await axios.get(`${BASE_URL}/image`, {
    headers,
    params: { resolution: "180", exerciseId },
    responseType: "arraybuffer",
  });
  return {
    data: Buffer.from(response.data),
    contentType: (response.headers["content-type"] as string) || "image/gif",
  };
};

// Obtener un ejercicio por ID
export const getExerciseById = async (id: string): Promise<Exercise> => {
  const response = await axios.get(`${BASE_URL}/exercises/exercise/${id}`, {
    headers,
  });
  return response.data;
};