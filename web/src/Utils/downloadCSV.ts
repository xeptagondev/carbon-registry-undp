export function downloadCSV(data: any, filename = 'data.csv') {
  // Convert array of data to CSV format
  const csvContent = data.map((row: any[]) => row.map(String).join(',')).join('\n');

  // Create a Blob and a temporary anchor element
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const link = document.createElement('a');

  // Create download link
  link.href = URL.createObjectURL(blob);
  link.download = filename;

  // Trigger the download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
}

// Example usage:
// const data = [
//     ["Name", "Age", "City"],
//     ["Alice", 25, "New York"],
//     ["Bob", 30, "Los Angeles"],
//     ["Charlie", 28, "Chicago"]
// ];

// // Call function to download CSV
// downloadCSV(data, "my_data.csv");
