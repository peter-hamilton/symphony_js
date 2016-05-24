function read(a)
{
    $("#scanned").text(a);
}
    
qrcode.callback = read;