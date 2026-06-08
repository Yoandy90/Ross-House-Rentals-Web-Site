<?php
/**
 * WhatsApp Webhook Proxy for Ross Tax Preparation
 * Este archivo recibe los webhooks de Meta y los reenvía al backend
 * 
 * Sube este archivo a: public_html/whatsapp-webhook.php
 * URL del webhook en Meta: https://rosstaxpreparation.com/whatsapp-webhook.php
 */

// Configuración
$VERIFY_TOKEN = 'rosstax2025';
<<<<<<< HEAD
$BACKEND_URL = 'https://banking-filter-hub.preview.emergentagent.com/api/whatsapp/webhook';
=======
$BACKEND_URL = 'https://banking-filter-hub.preview.emergentagent.com/api/whatsapp/webhook';
>>>>>>> ba1da97f2b345f38212b796c1ddcb11b99f842e2

// Headers para CORS
header('Content-Type: application/json');

// Log para debug (opcional - puedes eliminar en producción)
$log_file = __DIR__ . '/webhook_log.txt';
function logMessage($message) {
    global $log_file;
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($log_file, "[$timestamp] $message\n", FILE_APPEND);
}

// Manejar verificación de webhook (GET request)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode = $_GET['hub_mode'] ?? $_GET['hub.mode'] ?? '';
    $token = $_GET['hub_verify_token'] ?? $_GET['hub.verify_token'] ?? '';
    $challenge = $_GET['hub_challenge'] ?? $_GET['hub.challenge'] ?? '';
    
    logMessage("GET Request - Mode: $mode, Token: $token, Challenge: $challenge");
    
    if ($mode === 'subscribe' && $token === $VERIFY_TOKEN) {
        logMessage("Verification successful!");
        http_response_code(200);
        echo $challenge;
        exit;
    } else {
        logMessage("Verification failed - Expected token: $VERIFY_TOKEN");
        http_response_code(403);
        echo 'Verification failed';
        exit;
    }
}

// Manejar mensajes entrantes (POST request)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    logMessage("POST Request received: " . substr($input, 0, 500));
    
    // Reenviar al backend
    $ch = curl_init($BACKEND_URL);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($input)
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    logMessage("Backend response: HTTP $http_code - $response");
    
    if ($error) {
        logMessage("cURL Error: $error");
    }
    
    // Responder a Meta (siempre 200 para evitar reintentos)
    http_response_code(200);
    echo json_encode(['status' => 'received']);
    exit;
}

// Método no soportado
http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
