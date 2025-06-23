import Photopea from "photopea";

export default async function plugin() {
    let pea = new Photopea(window.parent);

    if ((new URLSearchParams(location.search)).get("isPhotopeaPlugin") == "yessir") {
        document.querySelector("#uploadButton").style.display = "none";
        document.querySelector("#exportpanel").innerHTML = "";
        var finishButton = document.createElement("button");
        finishButton.innerText = "Add to Document";
        document.querySelector("#exportpanel").appendChild(finishButton);
        finishButton.addEventListener("click", function() {
            mainProcess(globals, async function() {
                await pea.openFromURL(document.querySelectorAll("canvas")[1].toDataURL(), true);
            }, true);
        });
        
        let blobber = await pea.exportImage("png");
        
        var img = new Image();
        img.src = URL.createObjectURL(blobber);
        globals.baseIMG = img;
        img.addEventListener("load", function() {
            document.querySelector("canvas").width = this.width;
            document.querySelector("canvas").height = this.height;
            mainProcess(globals);
            document.querySelector("#landingscreen").style.display = "none";
        });

        globals.imgname = "thecoolness";
    }
    
}
