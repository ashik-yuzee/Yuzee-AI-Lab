package com.yuzee.tokenlab.dto;

public class AttachmentDto {
    private String mimeType;
    private String data; // base64-encoded

    public AttachmentDto() {}

    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }

    public String getData() { return data; }
    public void setData(String data) { this.data = data; }
}
