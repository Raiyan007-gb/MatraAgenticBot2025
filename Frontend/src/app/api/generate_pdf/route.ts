// src/app/api/generate_pdf/route.ts
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const BACKEND_URL = process.env.BACKEND_URL;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const backendResponse = await fetch(`${BACKEND_URL}/generate_pdf`, {
      method: 'POST',
      body: formData,
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
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="policy.pdf"',
      },
    });
  } catch (error) {
    console.error('Error in PDF generation route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF.';
    return new Response(errorMessage, { status: 500 });
  }
}