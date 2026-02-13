# Quan Ly Thu Chi (Contract Management System)

Project management and contract tracking system.

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher recommended)
- npm (Node Package Manager)

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/minhhghg01/Quan-Ly-Hop-Dong.git
    cd Quan-Ly-Hop-Dong
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Setup Data Directory:**
    The application stores data in the `data/` directory. If it doesn't exist, create it:
    ```bash
    mkdir data
    ```
    *Note: The application may automatically create necessary JSON files within this folder upon first run, or you may need to ensure write permissions.*

## Running the Application

1.  **Start the server:**
    ```bash
    node server.js
    ```

2.  **Access the application:**
    Open your web browser and navigate to:
    `http://localhost:3000` (or the port specified in the console output)

## Usage

- **Login:** Use the provided credentials (if any) or default admin setup.
- **Dashboard:** Manage contracts, view reports, and track expenses.
