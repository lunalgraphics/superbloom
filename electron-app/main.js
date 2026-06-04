const { app, BrowserWindow } = require("electron");

function createWindow () {

    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 900,
        webPreferences: {
            devTools: false
        },
        icon: "app/icon.png"
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile("app/index.html");
    mainWindow.setTitle("SuperBloom");
    mainWindow.on("page-title-updated", function(e) {
        e.preventDefault();
    });
    mainWindow.maximize();

}

app.whenReady().then(() => {
    createWindow();
});

app.on("window-all-closed", function () { app.quit(); });