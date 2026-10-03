"""Download only the approved public checkpoint, then verify its weight fingerprint."""
from common import digest
from forecast_contract import MODEL,REVISION,WEIGHTS_SHA


def cache():
    from huggingface_hub import hf_hub_download
    weights=hf_hub_download(MODEL,'model.safetensors',revision=REVISION,token=False)
    if digest(weights)!=WEIGHTS_SHA:raise RuntimeError('Checkpoint weights fingerprint mismatch')
    hf_hub_download(MODEL,'config.json',revision=REVISION,token=False)
    print('Pinned TimesFM checkpoint cached and weight fingerprint verified',flush=True)

if __name__=='__main__':cache()
