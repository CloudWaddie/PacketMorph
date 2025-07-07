// server.js
require('dotenv').config();
const genAI = require('@google/genai');
const net = require('net');
const fs = require('fs');
const path = require('path');
const ai = new genAI.GoogleGenAI({});

const staticWhitelist = ['favicon.ico'];

const server = net.createServer((socket) => {
    console.log('Client connected!');

    // Set a timeout for the socket to prevent hanging connections
    socket.setTimeout(300000); // 5 minutes

    let rawRequest = '';
    const maxRequestSize = 1 * 1024 * 1024;

    socket.on('data', async (chunk) => {
        rawRequest += chunk.toString('utf8');

        const separator = '\r\n\r\n';
        const separatorIndex = rawRequest.indexOf(separator);

        if (separatorIndex !== -1) {
            const requestHeaders = rawRequest.substring(0, separatorIndex);
            const requestLine = requestHeaders.split('\r\n')[0];
            const [method, requestPath] = requestLine.split(' ');

            if (method === 'GET') {
                const requestedFile = path.basename(requestPath);
                if (staticWhitelist.includes(requestedFile)) {
                    const filePath = path.join(__dirname, requestedFile);
                    fs.readFile(filePath, (err, data) => {
                        if (err) {
                            socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                            socket.end();
                        } else {
                            let contentType = 'application/octet-stream';
                            if (filePath.endsWith('.ico')) {
                                contentType = 'image/x-icon';
                            }
                            socket.write(`HTTP/1.1 200 OK\r\n`);
                            socket.write(`Content-Type: ${contentType}\r\n`);
                            socket.write(`Content-Length: ${data.length}\r\n`);
                            socket.write('\r\n');
                            socket.write(data);
                            socket.end();
                        }
                    });
                    return;
                }
            }
            
            // Generate response using the Google GenAI API
            const prompt = fs.readFileSync(path.join(__dirname, 'prompt.txt'), 'utf-8');
            const response = await ai.models.generateContent({model: 'gemini-2.5-pro', contents: prompt + rawRequest});
            socket.write(response.text);
            socket.end(); // Close the connection after sending response
        }

        if (rawRequest.length > maxRequestSize) {
            console.warn('Request too large, closing connection.');
            socket.end('HTTP/1.1 413 Request Entity Too Large\r\n\r\n');
        }
    });

    socket.on('end', () => {
        console.log('Client disconnected.');
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err.message);
        socket.end('HTTP/1.1 500 Internal Server Error\r\n\r\n');
    });

    socket.on('timeout', () => {
        console.warn('Socket timed out!');
        socket.end('HTTP/1.1 408 Request Timeout\r\n\r\n');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Raw HTTP server listening on port ${PORT}`);
    console.log(`Try: curl http://localhost:${PORT}`);
});
