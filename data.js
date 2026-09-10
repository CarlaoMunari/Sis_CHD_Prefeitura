// Dados iniciais baseados na planilha fornecida
const initialData = [
    { id: 1, marca: "Brother", modelo: "MFC-L8600CDW", toner: "TN-316 / TN-319", quantidade: 5, estoqueMinimo: 5, realizarPedido: false },
    { id: 2, marca: "Brother", modelo: "HL-5370DW", toner: "TN-580 / TN-620 / TN-650", quantidade: 7, estoqueMinimo: 5, realizarPedido: false },
    { id: 3, marca: "Brother", modelo: "DCP-8070D", toner: "TN-580 / TN-620 / TN-650", quantidade: 7, estoqueMinimo: 5, realizarPedido: false },
    { id: 4, marca: "Brother", modelo: "DCP-8080DN", toner: "TN-580 / TN-620 / TN-650", quantidade: 7, estoqueMinimo: 5, realizarPedido: false },
    { id: 5, marca: "Brother", modelo: "MFC-8480DN", toner: "TN-580 / TN-620 / TN-650", quantidade: 7, estoqueMinimo: 5, realizarPedido: false },
    { id: 6, marca: "Brother", modelo: "MFC-8890DW", toner: "TN-580 / TN-620 / TN-650", quantidade: 7, estoqueMinimo: 5, realizarPedido: false },
    { id: 7, marca: "Brother", modelo: "DCP-L2540DW", toner: "TN-660 / TN-2340 / TN-2370", quantidade: 6, estoqueMinimo: 5, realizarPedido: false },
    { id: 8, marca: "Brother", modelo: "DCP-1617MW", toner: "TN-1060", quantidade: 14, estoqueMinimo: 5, realizarPedido: false },
    { id: 9, marca: "Brother", modelo: "DCP-L2540DW", toner: "TN-2340 / TN-2370 / TN-3422 / TN-3442", quantidade: 7, estoqueMinimo: 5, realizarPedido: false },
    { id: 10, marca: "Brother", modelo: "HL-B2080DW", toner: "TN-B021", quantidade: 7, estoqueMinimo: 5, realizarPedido: false },
    { id: 11, marca: "Brother", modelo: "HL-L5202DW", toner: "TN-3422 / TN-3442 / TN-3472", quantidade: 26, estoqueMinimo: 5, realizarPedido: false },
    { id: 12, marca: "Brother", modelo: "DCP-L5652DN", toner: "TN-3422 / TN-3442 / TN-3472", quantidade: 26, estoqueMinimo: 5, realizarPedido: false },
    { id: 13, marca: "Brother", modelo: "DCP-8157DW", toner: "TN-3422 / TN-3442 / TN-3472", quantidade: 26, estoqueMinimo: 5, realizarPedido: false },
    { id: 14, marca: "Brother", modelo: "MFC-8712DW", toner: "TN-3422 / TN-3442 / TN-3472", quantidade: 26, estoqueMinimo: 5, realizarPedido: false },
    { id: 15, marca: "Brother", modelo: "MFC-J6510DW", toner: "LC75BK / LC75C / LC75Y / LC75M", quantidade: 16, estoqueMinimo: 5, realizarPedido: false },
    { id: 16, marca: "Brother", modelo: "DCP-L5512DN", toner: "BQ-TN3612", quantidade: 2, estoqueMinimo: 5, realizarPedido: true },
    { id: 17, marca: "Brother", modelo: "DCP-L3560CDW", toner: "TN219", quantidade: 0, estoqueMinimo: 5, realizarPedido: true },
    { id: 18, marca: "Canon", modelo: "G3110", toner: "Tank", quantidade: 0, estoqueMinimo: 5, realizarPedido: true },
    { id: 19, marca: "Elgin", modelo: "Pantum P2500W", toner: "PB-210 / PB-211", quantidade: 3, estoqueMinimo: 5, realizarPedido: true },
    { id: 20, marca: "Epson", modelo: "L555", toner: "544 Tank", quantidade: 6, estoqueMinimo: 5, realizarPedido: false },
    { id: 21, marca: "Epson", modelo: "L3110", toner: "544 Tank", quantidade: 6, estoqueMinimo: 5, realizarPedido: false },
    { id: 22, marca: "Epson", modelo: "L3150", toner: "544 Tank", quantidade: 6, estoqueMinimo: 5, realizarPedido: false },
    { id: 23, marca: "Epson", modelo: "L3210", toner: "544 Tank", quantidade: 6, estoqueMinimo: 5, realizarPedido: false },
    { id: 24, marca: "Epson", modelo: "L3250", toner: "544 Tank", quantidade: 6, estoqueMinimo: 5, realizarPedido: false },
    { id: 25, marca: "Epson", modelo: "L4260", toner: "544 Tank", quantidade: 6, estoqueMinimo: 5, realizarPedido: false },
    { id: 26, marca: "Epson", modelo: "L6490", toner: "544 Tank", quantidade: 6, estoqueMinimo: 5, realizarPedido: false },
    { id: 27, marca: "HP", modelo: "LaserJet 1020 / 3052", toner: "12A", quantidade: 17, estoqueMinimo: 5, realizarPedido: false },
    { id: 28, marca: "HP", modelo: "LaserJet Pro M426 DW", toner: "CF226X / P-740-A", quantidade: 5, estoqueMinimo: 5, realizarPedido: false },
    { id: 29, marca: "HP", modelo: "LaserJet P1005", toner: "35A", quantidade: 16, estoqueMinimo: 5, realizarPedido: false },
    { id: 30, marca: "HP", modelo: "LaserJet M1120 MFP", toner: "36A", quantidade: 16, estoqueMinimo: 5, realizarPedido: false },
    { id: 31, marca: "HP", modelo: "LaserJet Pro MFP-M428 FDW", toner: "58X", quantidade: 16, estoqueMinimo: 5, realizarPedido: false },
    { id: 32, marca: "HP", modelo: "LaserJet Pro MFP-4103 FDW", toner: "W1030X", quantidade: 5, estoqueMinimo: 5, realizarPedido: false },
    { id: 33, marca: "HP", modelo: "LaserJet Pro 400 M401 DN", toner: "80A / 80X / 500X / 505X", quantidade: 6, estoqueMinimo: 5, realizarPedido: false },
    { id: 34, marca: "HP", modelo: "LaserJet Pro M125A MFP", toner: "83A", quantidade: 16, estoqueMinimo: 5, realizarPedido: false },
    { id: 35, marca: "HP", modelo: "LaserJet M1132 MFP", toner: "85A", quantidade: 10, estoqueMinimo: 5, realizarPedido: false },
    { id: 36, marca: "HP", modelo: "LaserJet P1102", toner: "85A", quantidade: 10, estoqueMinimo: 5, realizarPedido: false },
    { id: 37, marca: "HP", modelo: "LaserJet P1102W", toner: "85A", quantidade: 10, estoqueMinimo: 5, realizarPedido: false },
    { id: 38, marca: "HP", modelo: "Laser M1132 MFP", toner: "85A", quantidade: 10, estoqueMinimo: 5, realizarPedido: false },
    { id: 39, marca: "HP", modelo: "LaserJet Pro P1102W", toner: "85A", quantidade: 10, estoqueMinimo: 5, realizarPedido: false },
    { id: 40, marca: "HP", modelo: "LaserJet P1005", toner: "85A", quantidade: 10, estoqueMinimo: 5, realizarPedido: false },
    { id: 41, marca: "HP", modelo: "LaserJet CP1025 Color", toner: "126A / Ce310A / 311A / 312A / 313A", quantidade: 0, estoqueMinimo: 5, realizarPedido: true },
    { id: 42, marca: "HP", modelo: "LaserJet Pro 400 Color M451DW", toner: "305A / Ce410 / Ce411 / Ce412 / Ce413", quantidade: 0, estoqueMinimo: 5, realizarPedido: true },
    { id: 43, marca: "HP", modelo: "MFP-E52645", toner: "W9008MC", quantidade: 3, estoqueMinimo: 5, realizarPedido: true },
    { id: 44, marca: "HP", modelo: "DesignJet T120", toner: "544 Tank", quantidade: 6, estoqueMinimo: 5, realizarPedido: false },
    { id: 45, marca: "Lexmark", modelo: "MS517DN", toner: "51B4H00", quantidade: 10, estoqueMinimo: 5, realizarPedido: false },
    { id: 46, marca: "Lexmark", modelo: "MX310DN", toner: "60FBH00", quantidade: 10, estoqueMinimo: 5, realizarPedido: false },
    { id: 47, marca: "Samsung", modelo: "Xpress M2875FD", toner: "MLT-D116", quantidade: 6, estoqueMinimo: 5, realizarPedido: false },
    { id: 48, marca: "Xerox", modelo: "B210", toner: "B205 / B210 / 215", quantidade: 9, estoqueMinimo: 5, realizarPedido: false },
    { id: 49, marca: "Xerox", modelo: "B230", toner: "LXB230L", quantidade: 6, estoqueMinimo: 5, realizarPedido: false }
];

// Função para inicializar dados no localStorage se não existirem
function initializeData() {
    if (!localStorage.getItem('tonersData')) {
        localStorage.setItem('tonersData', JSON.stringify(initialData));
    }
}

// Função para obter dados do localStorage
function getData() {
    try {
        const data = localStorage.getItem('tonersData');
        if (!data) {
            return [];
        }
        
        const parsedData = JSON.parse(data);
        
        // Validar estrutura dos dados
        if (!Array.isArray(parsedData)) {
            console.warn('Dados corrompidos detectados, reinicializando...');
            initializeData();
            return JSON.parse(localStorage.getItem('tonersData')) || [];
        }
        
        return parsedData;
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        console.warn('Reinicializando dados devido ao erro...');
        initializeData();
        return JSON.parse(localStorage.getItem('tonersData')) || [];
    }
}

// Função para salvar dados no localStorage
function saveData(data) {
    try {
        // Validar dados antes de salvar
        if (!Array.isArray(data)) {
            throw new Error('Dados devem ser um array');
        }
        
        const jsonString = JSON.stringify(data);
        localStorage.setItem('tonersData', jsonString);
        
        // Verificar se foi salvo corretamente
        const saved = localStorage.getItem('tonersData');
        if (!saved || saved !== jsonString) {
            throw new Error('Falha na verificação de salvamento');
        }
        
        return true;
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
        throw error;
    }
}

// Inicializar dados ao carregar o script
initializeData();
