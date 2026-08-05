export const assetPrintHTML = (asset: any) => {
  const rows = [
    { label: 'Asset ID', value: asset.id },
    { label: 'Name', value: asset.name },
    { label: 'Type', value: asset.type },
    { label: 'Property', value: asset.property || asset.property_id || '-' },
    { label: 'Serial', value: asset.serialNumber || '-' },
    { label: 'Quantity', value: asset.quantity ?? '-' },
    { label: 'Location', value: asset.location || '-' },
    { label: 'Status', value: asset.status || '-' },
  ];
  const rowsHtml = rows
    .map(r => `<tr><td class="label">${r.label}</td><td class="value">${r.value}</td></tr>`)
    .join('');
  return `
    <html>
      <head>
        <title>Print Asset ${asset.id}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: Arial, Helvetica, sans-serif; padding: 0; margin: 0; }
          .print-container { max-width: 800px; margin: auto; padding: 20px; }
          h2 { text-align: center; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 8px 12px; border: 1px solid #333; }
          .label { font-weight: bold; background: #f2f2f2; width: 30%; }
          .value { width: 70%; }
        </style>
      </head>
      <body>
        <div class="print-container">
          <h2>Asset Detail</h2>
          <table>
            ${rowsHtml}
          </table>
        </div>
      </body>
    </html>`;
};

export const employeePrintHTML = (emp: any) => {
  const rows = [
    { label: 'Employee ID', value: emp.employee_id },
    { label: 'Name', value: emp.full_name },
    { label: 'Job Position', value: emp.job_position },
    { label: 'Department', value: emp.department },
    { label: 'Hire Date', value: emp.hire_date ? new Date(emp.hire_date).toLocaleDateString() : '-' },
    { label: 'Status', value: emp.status },
  ];
  const rowsHtml = rows.map(r => `<div style="margin-bottom:6px;"><strong>${r.label}:</strong> ${r.value}</div>`).join('');
  return `
    <html><head><title>Print Employee ${emp.id}</title></head><body style="font-family:Arial,Helvetica,sans-serif;padding:20px;">
      <h2>Employee Detail</h2>
      ${rowsHtml}
    </body></html>`;
};

export const housePrintHTML = (h: any) => {
  const rows = [
    { label: 'House ID', value: h.house_id },
    { label: 'Name', value: h.name },
    { label: 'Property', value: h.property || '-' },
    { label: 'Location', value: h.location || '-' },
    { label: 'Status', value: h.status },
  ];
  const rowsHtml = rows.map(r => `<div style="margin-bottom:6px;"><strong>${r.label}:</strong> ${r.value}</div>`).join('');
  return `
    <html><head><title>Print House ${h.house_id}</title></head><body style="font-family:Arial,Helvetica,sans-serif;padding:20px;">
      <h2>House Detail</h2>
      ${rowsHtml}
    </body></html>`;
};

export const propertyPrintHTML = (p: any) => {
  const rows = [
    { label: 'Property ID', value: p.id },
    { label: 'Name', value: p.name },
    { label: 'Address', value: p.address || '-' },
    { label: 'Status', value: p.status },
  ];
  const rowsHtml = rows.map(r => `<div style="margin-bottom:6px;"><strong>${r.label}:</strong> ${r.value}</div>`).join('');
  return `
    <html><head><title>Print Property ${p.id}</title></head><body style="font-family:Arial,Helvetica,sans-serif;padding:20px;">
      <h2>Property Detail</h2>
      ${rowsHtml}
    </body></html>`;
};
