# Shortening URLs with Google Functions and Google Sheets
We’ve all stumbled upon url shortening services like bit.ly, tinyurl.com or goo.gl (this last one was shut down a while ago). They spare us of having to communicate hard-to-spell or too long urls (has anyone tried to dictate over the phone the URL of a Google Drive folder?). Because if you can copy/paste a URL it might easy, but if you need to send it to someone in a limited length text (e.g. a SMS) or you want to encode it in a QR code (where shorter strings are easier to scan), it is preferable to have a url like http://bit.ly/something (random url, seems to lead to a MP3 with a song) instead of a url like this https://drive.google.com/drive/folders/0ByWO0aO1eI_MN1BEd3VNRUZENkU

A service like this just needs a database where to associate the short url (/something in the example above) with the long url (https://static.stereogum.com/blogs.dir/2/files/mp3/Glen%20Hansard%20-%20Hairshirt%20(Late%20Night%20With%20Jimmy%20Fallon).mp3 in the same example) and upon receiving a request for the short url would issue a HTTP 302 redirect to the requesting client.

In the setup I’m proposing the role of this database is fulfilled by a Google Sheet (I should mention from the beginning that this is more of a personal URL shortening list, not something meant for public — although in the end making it public would just mean giving anyone write access to the said Google Sheet) and the lookup logic is implemented by a Google Cloud Function.

# Domain setup

In order to make it completely serverless we could use capabilities of a domain registrar (I’m using Namecheap) to bulk resolve the requests for a specific domain/subdomain to a predefined URL (that of your Cloud Function). For Namecheap this feature is available for any domain using their Basic DNS under Manage (for the respective domain) / Redirect Domain
![image](https://github.com/user-attachments/assets/49c74f2d-1705-46ff-a76b-5dd8bcca3797)
Assuming that this management page is for short.domain, we could add a redirect by entering short.domain in the source URL and the URL of the function (that we’ll obtain below) in the destination URL.

# Google Sheets
As our “database” will be a Google Sheet, just create a spreadsheet document in Google Drive, name the first (default) spreadsheet ‘links’ and populate it with the redirects by entering the short URL on column A and the long URL on column B, like so

![image](https://github.com/user-attachments/assets/f83431c2-be2c-4f05-9f42-a51c14dd9ebf)
In this example http://short.domain/xyz will have to lead to https://google.com while http://short.domain/yt to the YouTube link listed there. The thing that you’ll need to make note of (and write/copy) is the document id (the url of GSheet will look something like https://docs.google.com/spreadsheets/d/123abcdef/edit#gid=0 which makes 123abcdef the document id)

# Google Cloud Console

You will need a project defined in Google Cloud Platform, if you don’t already have one. Once the project is created, a service account will be created for it looking similar with this my-url-project@appspot.gserviceaccount.com (my-url-project is the project ID for this new project). Add this email to the list of accounts with read access for the spreadsheet created above (open the document and click Share in the upper right part).

From there on is smooth sailing, if you use the code from here.

In a nutshell what the code does is:

- exposes a function (getLink see here) that reads some parameters from the environment (you could also pass those params through command line, but only if you run it yourself on some server — which defeats the serverless purpose). We’ll use this exported function in the GCF definition.
- This function reads (with some helper, not-exported function) one of the sheets in the document and takes the columns A and B from it.
- It then proceeds to iterate through items in column A, looking for the URL received in req.url. If it finds a match it will send a redirect to the corresponding item in column B. Otherwise it will redirect the user to a default URL.
- You’ll need to commit (using Git) the two (index.js and package.json) files to your own repo on Google Cloud Source Repositories. We’ll need this in the deployment phase. Presumably you could also use github.com if it is a public repo (but I haven’t tried, it might not work)
- Once this is done, you’ll need to deploy it — which can be achieved from the GCF console or using gcloud. I prefer the latter as it makes a faster re-deployment (if you need to change the function after a new commit for instance). The deployment command goes like this

```
gcloud functions deploy navigator --set-env-vars DOC_ID=123abcdef,SHEET_NAME=links,DEFAULT_URL=https://docs.google.com --allow-unauthenticated --memory 128MB --project my-url-project --region europe-west2 --timeout 10s --runtime nodejs8 --source https://source.developers.google.com/projects/my-url-project/repos/navigator/moveable-aliases/master/paths/ --trigger-http --entry-point getLink
```

As you can guess — the first bold item is the function name (the trigger url will include it) and the last bold item is the function name (taken from the sources on the repository where the source was committed). Other parameters appearing in the command are


- runtime: this is a nodejs v8 function (the language used to write the logic)
- trigger-http: the function should be triggered via HTTP/S
- region: where to deploy this function
- set-env-vars: we pass three variables DOC_ID (retrieved on the creation of the document in Drive), SHEET_NAME (name of the sheet with the links), DEFAULT_URL (where to redirect if no match)

Once deployed GCP will create a trigger for the function that will look something like this

https://europe-west2-my-url-project.cloudfunctions.net/navigator

(europe-west2 because we deployed in this region, my-url-project because that’s our project name and the last part — navigator- because that’s what we wanted to call the function).

Now any call to e.g. https://europe-west2-my-url-project.cloudfunctions.net/navigator/abc (assuming the spreadsheet defined as above) will redirect the user to https://drive.google.com. Note that (somehow un-intuitively if you’ve used expressJS before) req.url will be set to /abc even if the function responds to /navigator/abc.

That’s all folks!
