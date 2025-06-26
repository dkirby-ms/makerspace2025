mosquitto_sub -h $MQTT_HOSTNAME -p 8883 \
--cert client1-authnID.pem -i client1-authnID -u client1-authnID \
--key client1-authnID.key -t "devices/bitnet-device/telemetry" --tls-use-os-certs


mosquitto_pub -h $MQTT_HOSTNAME -p 8883 \
--cert client1-authnID.pem -i client1-authnID -u client1-authnID \
--cafile intermediate_ca.crt \
--key client1-authnID.key -t "devices/bitnet-device/telemetry" --tls-use-os-certs -m "test3"