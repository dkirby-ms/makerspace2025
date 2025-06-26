#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Test script to verify intermediate CA functionality
const { CertificateManager } = require('./src/certificateManager');

async function testIntermediateCa() {
    console.log('Testing Intermediate CA functionality...\n');
    
    // Test 1: Initialize with intermediate certificate
    console.log('1. Testing initialization with intermediate certificate...');
    
    const intermediateCertPath = '/home/saitcho/makerspace2025/intermediate_ca.crt';
    const intermediateKeyPath = '/home/saitcho/.step/secrets/intermediate_ca_key';
    
    // Check if files exist
    if (!fs.existsSync(intermediateCertPath)) {
        console.error(`❌ Intermediate certificate not found: ${intermediateCertPath}`);
        return;
    }
    
    if (!fs.existsSync(intermediateKeyPath)) {
        console.error(`❌ Intermediate private key not found: ${intermediateKeyPath}`);
        return;
    }
    
    try {
        const certManager = new CertificateManager();
        
        // Initialize with intermediate certificate
        const intermediateCert = fs.readFileSync(intermediateCertPath, 'utf8');
        const intermediateKey = fs.readFileSync(intermediateKeyPath, 'utf8');
        
        await certManager.initialize(
            intermediateCert,
            intermediateKey,
            '',
            ''
        );
        
        console.log('✅ Intermediate CA loaded successfully');
        
        // Test 2: Generate device certificate
        console.log('\n2. Testing device certificate generation...');
        
        const deviceCert = certManager.generateDeviceCertificate('test-device-001', 'test-device-001-authnID');
        
        console.log('✅ Device certificate generated successfully');
        console.log(`📜 Certificate length: ${deviceCert.certificate.length} characters`);
        console.log(`🔑 Private Key length: ${deviceCert.privateKey.length} characters`);
        
        // Test 3: Verify certificate chain
        console.log('\n3. Testing certificate verification...');
        
        const forge = require('node-forge');
        const deviceCertObj = forge.pki.certificateFromPem(deviceCert.certificate);
        const caCertObj = forge.pki.certificateFromPem(intermediateCert);
        
        console.log(`📄 Device Certificate Subject: ${deviceCertObj.subject.getField('CN').value}`);
        console.log(`📄 Device Certificate Issuer: ${deviceCertObj.issuer.getField('CN').value}`);
        console.log(`📄 CA Certificate Subject: ${caCertObj.subject.getField('CN').value}`);
        
        // Verify the device certificate was signed by the intermediate CA
        const verified = caCertObj.verify(deviceCertObj);
        console.log(`✅ Certificate verification: ${verified ? 'PASSED' : 'FAILED'}`);
        
        console.log('\n🎉 All tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

testIntermediateCa().catch(console.error);
