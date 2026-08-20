const ExcelJSMock = {
  Workbook: class WorkbookMock {
    creator = '';
    company = '';
    created = new Date();
    xlsx = { writeBuffer: async () => Buffer.from([]) };
    addWorksheet() {
      return {
        columns: [],
        addRow: () => undefined,
        getRow: () => ({ font: {}, alignment: {} }),
        getColumn: () => ({ numFmt: '' }),
        autoFilter: '',
      };
    }
  },
};

export default ExcelJSMock;
