import jwt from 'jsonwebtoken';
import { env } from './src/backend/config/env';
import fetch from 'node-fetch';

async function test() {
  const token = jwt.sign({ id: 'some-admin-id', role: 'ADMIN' }, env.JWT_SECRET, { expiresIn: '1h' });
  const res = await fetch('http://localhost:3000/api/v1/customers?limit=1', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

test();
