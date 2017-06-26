function calculateChecksum(aBuffer) {
    var calculatedChecksum = 0;
    for (var i = 0; i < aBuffer.length; i++) {
        calculatedChecksum += aBuffer.readUInt8(i);
    }
    calculatedChecksum = calculatedChecksum & 0xFF ^ 0xFF;
    return calculatedChecksum
}

module.exports = {
    calculateChecksum: calculateChecksum
};