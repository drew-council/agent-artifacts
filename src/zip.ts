// Standard ZIP, STORE method: no platform-specific zip executable or runtime dependencies.
export interface ZipFile {
	name: string;
	data: Uint8Array;
}
const encoder = new TextEncoder();
function crc32(data: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit++)
			crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
	}
	return (crc ^ 0xffffffff) >>> 0;
}
function record(size: number): { bytes: Uint8Array; view: DataView } {
	const bytes = new Uint8Array(size);
	return { bytes, view: new DataView(bytes.buffer) };
}
export function zip(files: ZipFile[]): Uint8Array {
	if (files.length > 65535) throw new Error("Too many ZIP entries");
	const chunks: Uint8Array[] = [];
	const central: Uint8Array[] = [];
	let offset = 0;
	let centralSize = 0;
	for (const file of files) {
		if (
			!file.name ||
			file.name.startsWith("/") ||
			file.name.includes("\\") ||
			file.name.split("/").some((part) => part === ".." || part === ".")
		)
			throw new Error("Invalid ZIP path");
		const name = encoder.encode(file.name);
		const crc = crc32(file.data);
		const local = record(30 + name.length);
		local.view.setUint32(0, 0x04034b50, true);
		local.view.setUint16(4, 20, true);
		local.view.setUint16(6, 0x0800, true);
		local.view.setUint16(12, 33, true); // 1980-01-01
		local.view.setUint32(14, crc, true);
		local.view.setUint32(18, file.data.length, true);
		local.view.setUint32(22, file.data.length, true);
		local.view.setUint16(26, name.length, true);
		local.bytes.set(name, 30);
		chunks.push(local.bytes, file.data);
		const entry = record(46 + name.length);
		entry.view.setUint32(0, 0x02014b50, true);
		entry.view.setUint16(4, 20, true);
		entry.view.setUint16(6, 20, true);
		entry.view.setUint16(8, 0x0800, true);
		entry.view.setUint16(14, 33, true);
		entry.view.setUint32(16, crc, true);
		entry.view.setUint32(20, file.data.length, true);
		entry.view.setUint32(24, file.data.length, true);
		entry.view.setUint16(28, name.length, true);
		entry.view.setUint32(42, offset, true);
		entry.bytes.set(name, 46);
		central.push(entry.bytes);
		centralSize += entry.bytes.length;
		offset += local.bytes.length + file.data.length;
	}
	const end = record(22);
	end.view.setUint32(0, 0x06054b50, true);
	end.view.setUint16(8, files.length, true);
	end.view.setUint16(10, files.length, true);
	end.view.setUint32(12, centralSize, true);
	end.view.setUint32(16, offset, true);
	const output = new Uint8Array(offset + centralSize + end.bytes.length);
	let cursor = 0;
	for (const chunk of [...chunks, ...central, end.bytes]) {
		output.set(chunk, cursor);
		cursor += chunk.length;
	}
	return output;
}
