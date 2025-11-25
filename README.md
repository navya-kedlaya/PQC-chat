# PQChat

A post-quantum secure chat application using Kyber for key encapsulation and Dilithium for digital signatures.

## Features

- End-to-end encryption using post-quantum cryptography
- Real-time messaging using WebSocket
- Modern React UI with Tailwind CSS
- Kyber for key encapsulation
- Dilithium for digital signatures
- AES-GCM for symmetric encryption

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/pqchat.git
cd pqchat
```

2. Install dependencies:

```bash
npm install
```

## Cloud Relay Setup

The new cloud relay uses Firebase Authentication and Firestore so that any two
devices can discover one another and exchange encrypted messages via the cloud.

1. [Create a Firebase project](https://console.firebase.google.com) and enable
   **Anonymous Authentication** and **Cloud Firestore**.
2. Copy the project's web configuration into `src/firebase.js`.
3. (Optional) Update your Firestore security rules to restrict read/write access
   to authenticated users only.

## Development

To run the application in development mode:

```bash
npm run dev
```

This starts the React dev server. Anonymous Firebase auth will provision a
unique ID per browser tab so you can open a second browser (or machine) and
chat through Firestore without hosting your own WebSocket server.

## Production

To build and run the application in production mode:

1. Build the React application:

```bash
npm run build
```

2. Start the server:

```bash
npm start
```

## Security

This application uses post-quantum cryptography to ensure security against quantum computers:

- Kyber for key encapsulation (KEM)
- Dilithium for digital signatures
- AES-GCM for symmetric encryption
- HKDF for key derivation

## License

MIT
