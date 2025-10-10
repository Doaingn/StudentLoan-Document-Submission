// สร้างไฟล์ testConnection.js ในโฟลเดอร์หลักของแอป
// เพื่อทดสอบการเชื่อมต่อ AI backend

import React, { useEffect, useState } from 'react';
import { View, Text, Button, ScrollView, StyleSheet } from 'react-native';

const TestConnection = () => {
  const [testResults, setTestResults] = useState([]);
  const [testing, setTesting] = useState(false);

  const addResult = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [...prev, { message, type, timestamp }]);
    console.log(`[${timestamp}] ${message}`);
  };

  const testEnvironmentVariables = () => {
    addResult('=== Testing Environment Variables ===', 'header');
    
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    const useBackend = process.env.EXPO_PUBLIC_USE_AI_BACKEND;
    const backendUrl = process.env.EXPO_PUBLIC_AI_BACKEND_URL;
    
    addResult(`API Key: ${apiKey ? 'SET ✅' : 'NOT SET ❌'}`, apiKey ? 'success' : 'error');
    addResult(`Use Backend: ${useBackend}`, 'info');
    addResult(`Backend URL: ${backendUrl}`, 'info');
    
    if (apiKey && apiKey.startsWith('AIzaSy')) {
      addResult('API Key format looks correct ✅', 'success');
    } else {
      addResult('API Key format may be incorrect ❌', 'error');
    }
  };

  const testServerConnection = async () => {
    addResult('=== Testing Server Connection ===', 'header');
    
    const backendUrl = process.env.EXPO_PUBLIC_AI_BACKEND_URL;
    
    try {
      addResult(`Connecting to: ${backendUrl}/health...`);
      
      const response = await fetch(`${backendUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      
      if (response.ok) {
        const data = await response.json();
        addResult(`✅ Server is reachable!`, 'success');
        addResult(`Server status: ${data.status}`, 'success');
        addResult(`Server message: ${data.message}`, 'info');
        return true;
      } else {
        addResult(`❌ Server error: ${response.status}`, 'error');
        return false;
      }
    } catch (error) {
      addResult(`❌ Connection failed: ${error.message}`, 'error');
      addResult('Possible solutions:', 'info');
      addResult('1. Check if server is running (npm start)', 'info');
      addResult('2. Check IP address in .env file', 'info');
      addResult('3. Check firewall settings', 'info');
      addResult('4. Try using http://localhost:3001 if on same machine', 'info');
      return false;
    }
  };

  const testAIEndpoint = async () => {
    addResult('=== Testing AI Endpoint ===', 'header');
    
    const backendUrl = process.env.EXPO_PUBLIC_AI_BACKEND_URL;
    
    try {
      addResult('Testing AI connection through server...');
      
      const response = await fetch(`${backendUrl}/ai/test`, {
        method: 'GET',
        timeout: 15000,
      });
      
      if (response.ok) {
        const data = await response.json();
        addResult('✅ AI endpoint is working!', 'success');
        addResult(`AI response: ${data.response}`, 'success');
        return true;
      } else {
        const errorText = await response.text();
        addResult(`❌ AI endpoint error: ${response.status}`, 'error');
        addResult(`Error details: ${errorText}`, 'error');
        return false;
      }
    } catch (error) {
      addResult(`❌ AI test failed: ${error.message}`, 'error');
      return false;
    }
  };

  const testClientSideAI = async () => {
    addResult('=== Testing Client-Side AI ===', 'header');
    
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      
      if (!apiKey) {
        addResult('❌ No API key for client-side test', 'error');
        return false;
      }
      
      addResult('Initializing Gemini AI...');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      
      addResult('Sending test request...');
      const result = await model.generateContent("Test connection - respond with 'Hello from Gemini!'");
      const response = await result.response;
      const text = response.text();
      
      addResult('✅ Client-side AI is working!', 'success');
      addResult(`AI response: ${text}`, 'success');
      return true;
      
    } catch (error) {
      addResult(`❌ Client-side AI failed: ${error.message}`, 'error');
      
      if (error.message.includes('API key')) {
        addResult('API key issue - check your Gemini API key', 'error');
      } else if (error.message.includes('network')) {
        addResult('Network issue - check internet connection', 'error');
      }
      
      return false;
    }
  };

  const runAllTests = async () => {
    setTesting(true);
    setTestResults([]);
    
    addResult('🚀 Starting comprehensive AI backend test...', 'header');
    
    // Test 1: Environment Variables
    testEnvironmentVariables();
    
    // Test 2: Server Connection
    const serverOk = await testServerConnection();
    
    // Test 3: AI Endpoint (only if server is reachable)
    if (serverOk) {
      await testAIEndpoint();
    }
    
    // Test 4: Client-Side AI (fallback)
    await testClientSideAI();
    
    addResult('=== Test Complete ===', 'header');
    setTesting(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Backend Connection Test</Text>
      
      <Button
        title={testing ? "Testing..." : "Run Tests"}
        onPress={runAllTests}
        disabled={testing}
      />
      
      <ScrollView style={styles.resultsContainer}>
        {testResults.map((result, index) => (
          <Text
            key={index}
            style={[
              styles.resultText,
              styles[result.type] || styles.info
            ]}
          >
            [{result.timestamp}] {result.message}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  resultsContainer: {
    flex: 1,
    marginTop: 20,
    backgroundColor: '#000',
    padding: 10,
    borderRadius: 5,
  },
  resultText: {
    fontSize: 12,
    marginBottom: 2,
    fontFamily: 'monospace',
  },
  header: {
    color: '#00ffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  success: {
    color: '#00ff00',
  },
  error: {
    color: '#ff0000',
  },
  info: {
    color: '#ffffff',
  },
});

export default TestConnection;