// src/app/api/chat/route.ts
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const BACKEND_URL = process.env.BACKEND_URL;

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    if (!prompt) {
      return new Response('Prompt is required.', { status: 400 });
    }

    const userId = request.headers.get('x-user-id') || 'default_user';

    const backendResponse = await fetch(`${BACKEND_URL}/chat/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: prompt }),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      throw new Error(errorText || `Backend request failed with status ${backendResponse.status}`);
    }

    if (!backendResponse.body) {
      throw new Error('Backend response body is null.');
    }

    return new Response(backendResponse.body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Error in API route handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process chat request.';
    return new Response(errorMessage, { status: 500 });
  }
}