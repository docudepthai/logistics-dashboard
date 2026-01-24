import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({
  region: process.env.REGION || 'eu-central-1',
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY!,
  },
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'turkish-logistics-conversations';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// GET - Fetch all notes for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.email;

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `EMPLOYEE#${userId}`,
          ':sk': 'NOTE#',
        },
      })
    );

    const notes: Note[] = (result.Items || []).map((item) => ({
      id: item.noteId,
      title: item.title || '',
      content: item.content || '',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Failed to fetch notes:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

// POST - Create a new note
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.email;
    const body = await request.json();
    const noteId = randomUUID();
    const now = new Date().toISOString();

    const note = {
      pk: `EMPLOYEE#${userId}`,
      sk: `NOTE#${noteId}`,
      noteId,
      title: body.title || '',
      content: body.content || '',
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: note,
      })
    );

    return NextResponse.json({
      id: noteId,
      title: note.title,
      content: note.content,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    });
  } catch (error) {
    console.error('Failed to create note:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}

// PATCH - Update a note
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.email;
    const body = await request.json();
    const { id, title, content } = body;

    if (!id) {
      return NextResponse.json({ error: 'Note ID required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const note = {
      pk: `EMPLOYEE#${userId}`,
      sk: `NOTE#${id}`,
      noteId: id,
      title: title || '',
      content: content || '',
      updatedAt: now,
    };

    // Use PutCommand with conditional to ensure note exists and belongs to user
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...note,
          createdAt: body.createdAt || now,
        },
      })
    );

    return NextResponse.json({
      id,
      title: note.title,
      content: note.content,
      createdAt: body.createdAt || now,
      updatedAt: note.updatedAt,
    });
  } catch (error) {
    console.error('Failed to update note:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

// DELETE - Delete a note
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.email;
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Note ID required' }, { status: 400 });
    }

    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `EMPLOYEE#${userId}`,
          sk: `NOTE#${id}`,
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete note:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
