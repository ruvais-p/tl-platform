from django.db import migrations, models

import media_library.models


class Migration(migrations.Migration):
    dependencies = [("media_library", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="mediaasset",
            name="file",
            field=models.FileField(blank=True, upload_to=media_library.models.media_upload_path),
        ),
    ]
