import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrismaStore } from '../../helpers/mockDb.js';
import { FixtureFactory } from '../../helpers/fixtures.js';
import { createTestApp, api } from '../../helpers/testApp.js';

const { store, prismaMock, resetDb } = createMockPrismaStore();
const fixtures = new FixtureFactory(store);

vi.mock('../../../../utils/db.js', () => ({
  prisma: prismaMock,
}));

describe('Tier 1: Build Order Features (Features 1-5)', () => {
  let app: any;

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    app = createTestApp();
  });

  // ─── Feature 1: Build Scrap Outputs (/api/build/:pk/scrap-outputs) ───────────
  describe('Feature 1: Build Scrap Outputs', () => {
    it('1.1 should scrap entire build output item, marking status REJECTED (65) and logging tracking', async () => {
      const part = fixtures.seedPart({ name: 'Drone Assembly', assembly: true });
      const scrapLoc = fixtures.seedLocation({ name: 'Scrap Bin' });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '20', quantity: 5 });
      const output = fixtures.seedStockItem({
        partId: part.id,
        quantity: 2,
        isBuilding: true,
        buildId: build.id,
        status: '10',
      });

      const res = await api.post(app, `/api/build/${build.id}/scrap-outputs`, {
        outputs: [{ output: output.id, quantity: 2, location: scrapLoc.id, notes: 'Defective frame' }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('1.2 should scrap partial quantity of build output item by splitting quantity', async () => {
      const part = fixtures.seedPart({ name: 'Circuit Board', assembly: true });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '20', quantity: 10 });
      const output = fixtures.seedStockItem({
        partId: part.id,
        quantity: 5,
        isBuilding: true,
        buildId: build.id,
        status: '10',
      });

      const res = await api.post(app, `/api/build/${build.id}/scrap-outputs`, {
        outputs: [{ output: output.id, quantity: 2, notes: 'Soldering bridge on 2 units' }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('1.3 should scrap output to designated quarantine / scrap location', async () => {
      const part = fixtures.seedPart({ name: 'Solar Inverter', assembly: true });
      const scrapLoc = fixtures.seedLocation({ name: 'Rework & Scrap Area' });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '20', quantity: 3 });
      const output = fixtures.seedStockItem({
        partId: part.id,
        quantity: 1,
        isBuilding: true,
        buildId: build.id,
      });

      const res = await api.post(app, `/api/build/${build.id}/scrap-outputs`, {
        location: scrapLoc.id,
        outputs: [{ output: output.id, quantity: 1 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('1.4 should scrap multiple distinct build output items in a single request', async () => {
      const part = fixtures.seedPart({ name: 'Robotic Arm', assembly: true });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '20', quantity: 4 });
      const out1 = fixtures.seedStockItem({ partId: part.id, quantity: 1, isBuilding: true, buildId: build.id });
      const out2 = fixtures.seedStockItem({ partId: part.id, quantity: 1, isBuilding: true, buildId: build.id });

      const res = await api.post(app, `/api/build/${build.id}/scrap-outputs`, {
        outputs: [
          { output: out1.id, quantity: 1, notes: 'Motor burnout' },
          { output: out2.id, quantity: 1, notes: 'Stripped gear' },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('1.5 should scrap output with custom user tracking notes recorded', async () => {
      const part = fixtures.seedPart({ name: 'Power Supply Unit', assembly: true });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '20', quantity: 1 });
      const output = fixtures.seedStockItem({ partId: part.id, quantity: 1, isBuilding: true, buildId: build.id });

      const res = await api.post(app, `/api/build/${build.id}/scrap-outputs`, {
        outputs: [{ output: output.id, quantity: 1, notes: 'Voltage test failed QA step 4' }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Feature 2: Build Auto-Allocate (/api/build/:pk/auto-allocate) ───────────
  describe('Feature 2: Build Auto-Allocate', () => {
    it('2.1 should auto-allocate single build line from matching available stock item', async () => {
      const assembly = fixtures.seedPart({ name: 'Computer PC', assembly: true });
      const cpu = fixtures.seedPart({ name: 'Intel CPU', component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: cpu.id, quantity: 1 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 2 });
      fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 2 });
      fixtures.seedStockItem({ partId: cpu.id, quantity: 10, status: '10' });

      const res = await api.post(app, `/api/build/${build.id}/auto-allocate`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('2.2 should auto-allocate multiple build lines across multiple BOM components', async () => {
      const assembly = fixtures.seedPart({ name: 'Electric Scooter', assembly: true });
      const wheel = fixtures.seedPart({ name: 'Wheel', component: true });
      const battery = fixtures.seedPart({ name: 'Lithium Battery', component: true });
      const bom1 = fixtures.seedBomItem({ partId: assembly.id, subPartId: wheel.id, quantity: 2 });
      const bom2 = fixtures.seedBomItem({ partId: assembly.id, subPartId: battery.id, quantity: 1 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 5 });
      fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom1.id, quantity: 10 });
      fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom2.id, quantity: 5 });
      fixtures.seedStockItem({ partId: wheel.id, quantity: 50 });
      fixtures.seedStockItem({ partId: battery.id, quantity: 20 });

      const res = await api.post(app, `/api/build/${build.id}/auto-allocate`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('2.3 should auto-allocate across multiple stock items when single item has insufficient quantity', async () => {
      const assembly = fixtures.seedPart({ name: 'LED Matrix Panel', assembly: true });
      const led = fixtures.seedPart({ name: 'SMD LED', component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: led.id, quantity: 10 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 5 }); // Needs 50 LEDs
      fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 50 });
      fixtures.seedStockItem({ partId: led.id, quantity: 30, batch: 'BATCH-A' });
      fixtures.seedStockItem({ partId: led.id, quantity: 40, batch: 'BATCH-B' });

      const res = await api.post(app, `/api/build/${build.id}/auto-allocate`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('2.4 should auto-allocate respecting location filter parameter', async () => {
      const assembly = fixtures.seedPart({ name: 'Drone Kit', assembly: true });
      const motor = fixtures.seedPart({ name: 'Brushless Motor', component: true });
      const loc1 = fixtures.seedLocation({ name: 'Warehouse A' });
      const loc2 = fixtures.seedLocation({ name: 'Warehouse B' });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: motor.id, quantity: 4 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 4 });
      fixtures.seedStockItem({ partId: motor.id, locationId: loc1.id, quantity: 10 });
      fixtures.seedStockItem({ partId: motor.id, locationId: loc2.id, quantity: 10 });

      const res = await api.post(app, `/api/build/${build.id}/auto-allocate`, { location: loc1.id });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('2.5 should auto-allocate BOM items allowing substitute components when primary stock is 0', async () => {
      const assembly = fixtures.seedPart({ name: 'Audio Amplifier', assembly: true });
      const primaryOpAmp = fixtures.seedPart({ name: 'NE5532 Op-Amp', component: true });
      const subOpAmp = fixtures.seedPart({ name: 'OPA2134 Op-Amp (Substitute)', component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: primaryOpAmp.id, quantity: 2, allowVariants: true });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 2 });
      fixtures.seedStockItem({ partId: subOpAmp.id, quantity: 10 });

      const res = await api.post(app, `/api/build/${build.id}/auto-allocate`, { allow_substitutes: true });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Feature 3: Build Allocate (/api/build/:pk/allocate) ─────────────────────
  describe('Feature 3: Build Allocate', () => {
    it('3.1 should manually allocate exact required quantity of stock item to build line', async () => {
      const assembly = fixtures.seedPart({ name: 'Smart Thermostat', assembly: true });
      const sensor = fixtures.seedPart({ name: 'Temp Sensor', component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: sensor.id, quantity: 1 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 3 });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 3 });
      const stock = fixtures.seedStockItem({ partId: sensor.id, quantity: 10 });

      const res = await api.post(app, `/api/build/${build.id}/allocate`, {
        items: [{ build_line: line.id, stock_item: stock.id, quantity: 3 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('3.2 should manually allocate partial quantity of stock item to build line', async () => {
      const assembly = fixtures.seedPart({ name: 'Smart Thermostat', assembly: true });
      const sensor = fixtures.seedPart({ name: 'Temp Sensor', component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: sensor.id, quantity: 1 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 5 });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 5 });
      const stock = fixtures.seedStockItem({ partId: sensor.id, quantity: 20 });

      const res = await api.post(app, `/api/build/${build.id}/allocate`, {
        items: [{ build_line: line.id, stock_item: stock.id, quantity: 2 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('3.3 should manually allocate serialized stock item (quantity 1) to build line', async () => {
      const assembly = fixtures.seedPart({ name: 'Medical Monitor', assembly: true });
      const sensorModule = fixtures.seedPart({ name: 'ECG Module', component: true, trackable: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: sensorModule.id, quantity: 1 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 1 });
      const stock = fixtures.seedStockItem({ partId: sensorModule.id, quantity: 1, serial: 'SN-ECG-001' });

      const res = await api.post(app, `/api/build/${build.id}/allocate`, {
        items: [{ build_line: line.id, stock_item: stock.id, quantity: 1 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('3.4 should manually allocate stock item specifying target build output (install_into)', async () => {
      const assembly = fixtures.seedPart({ name: 'Desktop PC', assembly: true });
      const ram = fixtures.seedPart({ name: '16GB DDR5 RAM', component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: ram.id, quantity: 2 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      const output = fixtures.seedStockItem({ partId: assembly.id, quantity: 1, isBuilding: true, buildId: build.id });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 2 });
      const stock = fixtures.seedStockItem({ partId: ram.id, quantity: 16 });

      const res = await api.post(app, `/api/build/${build.id}/allocate`, {
        items: [{ build_line: line.id, stock_item: stock.id, quantity: 2, install_into: output.id }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('3.5 should manually allocate multiple stock items across multiple lines in single request', async () => {
      const assembly = fixtures.seedPart({ name: 'Quadrocopter', assembly: true });
      const motor = fixtures.seedPart({ name: '2205 Motor', component: true });
      const prop = fixtures.seedPart({ name: '5045 Propeller', component: true });
      const bom1 = fixtures.seedBomItem({ partId: assembly.id, subPartId: motor.id, quantity: 4 });
      const bom2 = fixtures.seedBomItem({ partId: assembly.id, subPartId: prop.id, quantity: 4 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      const line1 = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom1.id, quantity: 4 });
      const line2 = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom2.id, quantity: 4 });
      const stockMotor = fixtures.seedStockItem({ partId: motor.id, quantity: 10 });
      const stockProp = fixtures.seedStockItem({ partId: prop.id, quantity: 20 });

      const res = await api.post(app, `/api/build/${build.id}/allocate`, {
        items: [
          { build_line: line1.id, stock_item: stockMotor.id, quantity: 4 },
          { build_line: line2.id, stock_item: stockProp.id, quantity: 4 },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Feature 4: Build Unallocate (/api/build/:pk/unallocate) ─────────────────
  describe('Feature 4: Build Unallocate', () => {
    it('4.1 should unallocate all allocations for a build order', async () => {
      const assembly = fixtures.seedPart({ name: '3D Printer', assembly: true });
      const nozzle = fixtures.seedPart({ name: 'Brass Nozzle', component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: nozzle.id, quantity: 1 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 2 });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 2 });
      const stock = fixtures.seedStockItem({ partId: nozzle.id, quantity: 10 });
      fixtures.seedBuildItem({ buildLineId: line.id, stockItemId: stock.id, quantity: 2 });

      const res = await api.post(app, `/api/build/${build.id}/unallocate`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('4.2 should unallocate specific build line allocations only', async () => {
      const assembly = fixtures.seedPart({ name: '3D Printer', assembly: true });
      const nozzle = fixtures.seedPart({ name: 'Brass Nozzle', component: true });
      const heater = fixtures.seedPart({ name: 'Heater Cartridge', component: true });
      const bom1 = fixtures.seedBomItem({ partId: assembly.id, subPartId: nozzle.id, quantity: 1 });
      const bom2 = fixtures.seedBomItem({ partId: assembly.id, subPartId: heater.id, quantity: 1 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      const line1 = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom1.id, quantity: 1 });
      const line2 = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom2.id, quantity: 1 });
      const stock1 = fixtures.seedStockItem({ partId: nozzle.id, quantity: 5 });
      const stock2 = fixtures.seedStockItem({ partId: heater.id, quantity: 5 });
      fixtures.seedBuildItem({ buildLineId: line1.id, stockItemId: stock1.id, quantity: 1 });
      fixtures.seedBuildItem({ buildLineId: line2.id, stockItemId: stock2.id, quantity: 1 });

      const res = await api.post(app, `/api/build/${build.id}/unallocate`, {
        build_line: line1.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('4.3 should unallocate specific stock item allocation from build line', async () => {
      const assembly = fixtures.seedPart({ name: 'CNC Router', assembly: true });
      const collet = fixtures.seedPart({ name: 'ER11 Collet', component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: collet.id, quantity: 2 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 2 });
      const stock1 = fixtures.seedStockItem({ partId: collet.id, quantity: 5 });
      const alloc1 = fixtures.seedBuildItem({ buildLineId: line.id, stockItemId: stock1.id, quantity: 2 });

      const res = await api.post(app, `/api/build/${build.id}/unallocate`, {
        items: [alloc1.id],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('4.4 should unallocate partial quantity from an allocation', async () => {
      const assembly = fixtures.seedPart({ name: 'CNC Router', assembly: true });
      const collet = fixtures.seedPart({ name: 'ER11 Collet', component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: collet.id, quantity: 4 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 4 });
      const stock = fixtures.seedStockItem({ partId: collet.id, quantity: 10 });
      const alloc = fixtures.seedBuildItem({ buildLineId: line.id, stockItemId: stock.id, quantity: 4 });

      const res = await api.post(app, `/api/build/${build.id}/unallocate`, {
        items: [{ build_item: alloc.id, quantity: 2 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('4.5 should unallocate allocations linked to a specific build output target', async () => {
      const assembly = fixtures.seedPart({ name: 'Server Rack', assembly: true });
      const psu = fixtures.seedPart({ name: 'Redundant PSU', component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: psu.id, quantity: 2 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 2 });
      const output1 = fixtures.seedStockItem({ partId: assembly.id, quantity: 1, isBuilding: true, buildId: build.id });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 4 });
      const stock = fixtures.seedStockItem({ partId: psu.id, quantity: 10 });
      fixtures.seedBuildItem({ buildLineId: line.id, stockItemId: stock.id, quantity: 2, installIntoId: output1.id });

      const res = await api.post(app, `/api/build/${build.id}/unallocate`, {
        output: output1.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Feature 5: Build Consume (/api/build/:pk/consume) ───────────────────────
  describe('Feature 5: Build Consume', () => {
    it('5.1 should consume full allocation where deleteOnDeplete=true, deleting depleted stock item', async () => {
      const assembly = fixtures.seedPart({ name: 'Electronic Gadget', assembly: true });
      const cap = fixtures.seedPart({ name: '100uF Capacitor', component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: cap.id, quantity: 10 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 10 });
      const stock = fixtures.seedStockItem({ partId: cap.id, quantity: 10, deleteOnDeplete: true });
      fixtures.seedBuildItem({ buildLineId: line.id, stockItemId: stock.id, quantity: 10 });

      const res = await api.post(app, `/api/build/${build.id}/consume`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('5.2 should consume full allocation where deleteOnDeplete=false, retaining item with quantity 0', async () => {
      const assembly = fixtures.seedPart({ name: 'Electronic Gadget', assembly: true });
      const mcu = fixtures.seedPart({ name: 'STM32 Microcontroller', component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: mcu.id, quantity: 5 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 5 });
      const stock = fixtures.seedStockItem({ partId: mcu.id, quantity: 5, deleteOnDeplete: false });
      fixtures.seedBuildItem({ buildLineId: line.id, stockItemId: stock.id, quantity: 5 });

      const res = await api.post(app, `/api/build/${build.id}/consume`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('5.3 should consume partial quantity, decrementing stock item quantity accurately', async () => {
      const assembly = fixtures.seedPart({ name: 'Electronic Gadget', assembly: true });
      const screw = fixtures.seedPart({ name: 'M3 Screws', component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: screw.id, quantity: 20 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 20 });
      const stock = fixtures.seedStockItem({ partId: screw.id, quantity: 100 });
      fixtures.seedBuildItem({ buildLineId: line.id, stockItemId: stock.id, quantity: 20 });

      const res = await api.post(app, `/api/build/${build.id}/consume`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('5.4 should consume trackable component into assembly output, setting belongsToId to output item', async () => {
      const assembly = fixtures.seedPart({ name: 'Industrial Gateway', assembly: true, trackable: true });
      const module = fixtures.seedPart({ name: 'LTE Cat-M Module', component: true, trackable: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: module.id, quantity: 1 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      const output = fixtures.seedStockItem({ partId: assembly.id, quantity: 1, isBuilding: true, buildId: build.id, serial: 'SN-GW-001' });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 1 });
      const stock = fixtures.seedStockItem({ partId: module.id, quantity: 1, serial: 'SN-MOD-999' });
      fixtures.seedBuildItem({ buildLineId: line.id, stockItemId: stock.id, quantity: 1, installIntoId: output.id });

      const res = await api.post(app, `/api/build/${build.id}/consume`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('5.5 should log stockitemtracking entries for all consumed components', async () => {
      const assembly = fixtures.seedPart({ name: 'Sensor Node', assembly: true });
      const resistor = fixtures.seedPart({ name: '10k Resistor', component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: resistor.id, quantity: 4 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 4 });
      const stock = fixtures.seedStockItem({ partId: resistor.id, quantity: 50 });
      fixtures.seedBuildItem({ buildLineId: line.id, stockItemId: stock.id, quantity: 4 });

      const res = await api.post(app, `/api/build/${build.id}/consume`, {
        notes: 'Consumed for batch 2026-08',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
